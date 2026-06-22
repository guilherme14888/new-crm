-- Migration 039: logo por empresa (Default e cada tenant). Guarda URL http(s) OU
-- data URL base64 (MEDIUMTEXT cobre logos até ~16MB). A sidebar mostra o logo da
-- empresa ativa; nas filhas, o logo da Default aparece como miniatura sobreposta.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url MEDIUMTEXT NULL;
