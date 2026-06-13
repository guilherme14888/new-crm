-- Oportunidades entram como deals BLOQUEADOS na etapa "Oportunidade"; o botão
-- "Participar" desbloqueia (locked=0) para o card poder ir às demais etapas.
ALTER TABLE deals ADD COLUMN locked TINYINT(1) NOT NULL DEFAULT 0;
