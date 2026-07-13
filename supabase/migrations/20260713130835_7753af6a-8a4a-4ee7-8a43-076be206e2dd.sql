-- Corrective INE code migration (aditiva, transaccional, sin renombrar ni borrar filas)
-- Fase 1: asignar códigos temporales a los 24 slugs que deben cambiar
BEGIN;

UPDATE public.municipalities
SET ine_code = CASE
  WHEN slug = 'montecorto' THEN 'TMP001'
  WHEN slug = 'periana' THEN 'TMP002'
  WHEN slug = 'pizarra' THEN 'TMP003'
  WHEN slug = 'pujerra' THEN 'TMP004'
  WHEN slug = 'rincon-de-la-victoria' THEN 'TMP005'
  WHEN slug = 'riogordo' THEN 'TMP006'
  WHEN slug = 'ronda' THEN 'TMP007'
  WHEN slug = 'salares' THEN 'TMP008'
  WHEN slug = 'sayalonga' THEN 'TMP009'
  WHEN slug = 'sedella' THEN 'TMP010'
  WHEN slug = 'serrato' THEN 'TMP011'
  WHEN slug = 'sierra-de-yeguas' THEN 'TMP012'
  WHEN slug = 'teba' THEN 'TMP013'
  WHEN slug = 'tolox' THEN 'TMP014'
  WHEN slug = 'torrox' THEN 'TMP015'
  WHEN slug = 'totalan' THEN 'TMP016'
  WHEN slug = 'valle-de-abdalajis' THEN 'TMP017'
  WHEN slug = 'velez-malaga' THEN 'TMP018'
  WHEN slug = 'villanueva-de-algaidas' THEN 'TMP019'
  WHEN slug = 'villanueva-de-tapia' THEN 'TMP020'
  WHEN slug = 'villanueva-del-rosario' THEN 'TMP021'
  WHEN slug = 'villanueva-del-trabuco' THEN 'TMP022'
  WHEN slug = 'vinuela' THEN 'TMP023'
  WHEN slug = 'yunquera' THEN 'TMP024'
END
WHERE slug IN ('montecorto','periana','pizarra','pujerra','rincon-de-la-victoria','riogordo','ronda','salares','sayalonga','sedella','serrato','sierra-de-yeguas','teba','tolox','torrox','totalan','valle-de-abdalajis','velez-malaga','villanueva-de-algaidas','villanueva-de-tapia','villanueva-del-rosario','villanueva-del-trabuco','vinuela','yunquera');

-- Fase 2: asignar los códigos oficiales del INE
UPDATE public.municipalities
SET ine_code = CASE
  WHEN slug = 'montecorto' THEN '29903'
  WHEN slug = 'periana' THEN '29079'
  WHEN slug = 'pizarra' THEN '29080'
  WHEN slug = 'pujerra' THEN '29081'
  WHEN slug = 'rincon-de-la-victoria' THEN '29082'
  WHEN slug = 'riogordo' THEN '29083'
  WHEN slug = 'ronda' THEN '29084'
  WHEN slug = 'salares' THEN '29085'
  WHEN slug = 'sayalonga' THEN '29086'
  WHEN slug = 'sedella' THEN '29087'
  WHEN slug = 'serrato' THEN '29904'
  WHEN slug = 'sierra-de-yeguas' THEN '29088'
  WHEN slug = 'teba' THEN '29089'
  WHEN slug = 'tolox' THEN '29090'
  WHEN slug = 'torrox' THEN '29091'
  WHEN slug = 'totalan' THEN '29092'
  WHEN slug = 'valle-de-abdalajis' THEN '29093'
  WHEN slug = 'velez-malaga' THEN '29094'
  WHEN slug = 'villanueva-de-algaidas' THEN '29095'
  WHEN slug = 'villanueva-de-tapia' THEN '29098'
  WHEN slug = 'villanueva-del-rosario' THEN '29096'
  WHEN slug = 'villanueva-del-trabuco' THEN '29097'
  WHEN slug = 'vinuela' THEN '29099'
  WHEN slug = 'yunquera' THEN '29100'
END
WHERE ine_code LIKE 'TMP%';

-- Verificación final: falla la migración si algo no cuadra
DO $$
DECLARE
  active_count int;
  unique_count int;
  bad_count int;
BEGIN
  SELECT count(*) INTO active_count FROM public.municipalities WHERE active = true;
  SELECT count(DISTINCT ine_code) INTO unique_count FROM public.municipalities WHERE active = true;

  IF active_count <> 103 THEN
    RAISE EXCEPTION 'INE check: expected 103 active municipalities, got %', active_count;
  END IF;
  IF unique_count <> 103 THEN
    RAISE EXCEPTION 'INE check: expected 103 unique ine_codes, got %', unique_count;
  END IF;

  -- casos críticos
  IF NOT EXISTS (SELECT 1 FROM public.municipalities WHERE slug='montecorto' AND ine_code='29903') THEN
    RAISE EXCEPTION 'INE check: Montecorto must be 29903';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.municipalities WHERE slug='serrato' AND ine_code='29904') THEN
    RAISE EXCEPTION 'INE check: Serrato must be 29904';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.municipalities WHERE slug='villanueva-de-la-concepcion' AND ine_code='29902') THEN
    RAISE EXCEPTION 'INE check: Villanueva de la Concepción must be 29902';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.municipalities WHERE slug='yunquera' AND ine_code='29100') THEN
    RAISE EXCEPTION 'INE check: Yunquera must be 29100';
  END IF;

  -- ningún código temporal residual
  SELECT count(*) INTO bad_count FROM public.municipalities WHERE ine_code LIKE 'TMP%';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'INE check: % residual TMP codes', bad_count;
  END IF;
END $$;

COMMIT;