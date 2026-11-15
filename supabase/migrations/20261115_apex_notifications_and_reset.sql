-- Raziel | Migração segura: notificações de Ápice + reset/recalibração
-- Aplicar no Supabase SQL Editor antes de publicar o frontend.
--
-- Esta migration:
-- 1) registra o instante real em que cada Ápice passa de bloqueado para desbloqueado;
-- 2) expõe esse instante na RPC já usada pelo frontend;
-- 3) corrige o reset para usar WHERE explícito (o ambiente está exigindo WHERE em UPDATE);
-- 4) preserva pontos dos talentos e recalcula os Ápices pelos triggers existentes.
--
-- Não altera talentos, pré-requisitos, pontos de talentos ou requisitos de árvores.

BEGIN;

ALTER TABLE public.talent_tree_apices
    ADD COLUMN IF NOT EXISTS unlocked_at timestamptz;

CREATE OR REPLACE FUNCTION public.track_talent_tree_apex_unlock_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF COALESCE(NEW.is_unlocked, false)
           AND NOT COALESCE(NEW.is_hidden, true) THEN
            NEW.unlocked_at := COALESCE(NEW.unlocked_at, now());
        ELSE
            NEW.unlocked_at := NULL;
        END IF;
    ELSE
        IF COALESCE(NEW.is_unlocked, false)
           AND NOT COALESCE(NEW.is_hidden, true)
           AND (
               NOT COALESCE(OLD.is_unlocked, false)
               OR COALESCE(OLD.is_hidden, true)
           ) THEN
            NEW.unlocked_at := now();
        ELSIF NOT COALESCE(NEW.is_unlocked, false)
           OR COALESCE(NEW.is_hidden, true) THEN
            NEW.unlocked_at := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS track_talent_tree_apex_unlock_timestamp
    ON public.talent_tree_apices;

CREATE TRIGGER track_talent_tree_apex_unlock_timestamp
BEFORE INSERT OR UPDATE ON public.talent_tree_apices
FOR EACH ROW
EXECUTE FUNCTION public.track_talent_tree_apex_unlock_timestamp();

-- Registros já desbloqueados permanecem com unlocked_at = NULL.
-- Isso evita notificações falsas para Ápices antigos (por exemplo, requisitos 0).
-- A coluna recebe timestamp somente na próxima transição real para desbloqueado.

-- A mesma RPC passa a devolver unlocked_at, que identifica uma ocorrência
-- específica de desbloqueio e permite repetir a notificação após novo reset.
CREATE OR REPLACE FUNCTION public.get_talent_tree_apex_for_player(
    p_tree_key text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
    SELECT jsonb_build_object(
        'tree_key', a.tree_key,
        'name', CASE
            WHEN COALESCE(a.is_hidden, true) THEN '???'
            ELSE a.name
        END,
        'icon_url', CASE
            WHEN COALESCE(a.is_hidden, true) THEN NULL
            ELSE a.icon_url
        END,
        'required_points', COALESCE(a.required_points, 0),
        'description', CASE
            WHEN COALESCE(a.is_hidden, true) THEN NULL
            ELSE a.description
        END,
        'is_available', COALESCE(a.is_unlocked, false) AND NOT COALESCE(a.is_hidden, true),
        'is_revealed', NOT COALESCE(a.is_hidden, true),
        'is_unlocked', COALESCE(a.is_unlocked, false),
        'is_hidden', COALESCE(a.is_hidden, true),
        'unlocked_at', a.unlocked_at,
        'current_points', COALESCE((to_jsonb(v)->>'current_points')::integer, 0)
    )
    FROM public.talent_tree_apices a
    LEFT JOIN public.talent_tree_apices_safe_v2 v
        ON v.tree_key = a.tree_key
    WHERE a.tree_key = p_tree_key
    LIMIT 1;
$function$;

-- A ação é restrita a administradores. O WHERE tree_key IS NOT NULL é
-- intencional: além de documentar o escopo, satisfaz a proteção safe-update
-- habilitada no ambiente. tree_key é NOT NULL no schema atual.
CREATE OR REPLACE FUNCTION public.reset_talent_tree_apices_progress()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_reset_count integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Autenticação necessária.';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso restrito a administradores.';
    END IF;

    UPDATE public.talent_tree_apices
    SET
        current_points = 0,
        is_unlocked = false,
        is_hidden = true,
        is_revealed = false,
        is_manually_locked = false,
        updated_at = now()
    WHERE tree_key IS NOT NULL;

    GET DIAGNOSTICS v_reset_count = ROW_COUNT;

    -- O trigger de atualização também executa esta rotina. A chamada explícita
    -- torna a RPC resiliente caso o trigger seja temporariamente desabilitado
    -- durante manutenção. A função de sincronização é idempotente.
    PERFORM public.refresh_automatic_compendium_unlocks();

    RETURN v_reset_count;
END;
$function$;

REVOKE ALL
ON FUNCTION public.reset_talent_tree_apices_progress()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.reset_talent_tree_apices_progress()
FROM anon;

GRANT EXECUTE
ON FUNCTION public.reset_talent_tree_apices_progress()
TO authenticated;

COMMIT;

-- Validação pós-migration:
SELECT
    tree_key,
    required_points,
    current_points,
    is_unlocked,
    is_hidden,
    is_revealed,
    is_manually_locked,
    unlocked_at
FROM public.talent_tree_apices
ORDER BY tree_key;
