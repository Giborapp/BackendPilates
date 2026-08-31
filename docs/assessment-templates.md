# Modelos de anamnese e avaliacao

Modelos pertencem ao estúdio autenticado e usam `AssessmentTemplate`. O público pode ser `STUDENT` ou `PROFESSIONAL`.

Cada estúdio pode manter no máximo três modelos `PUBLISHED`. Rascunhos e versões arquivadas não ocupam vaga. Cada versão pode ter até 40 perguntas; itens `section` não entram na contagem. O limite é aplicado no backend.

## Endpoints

- `GET /assessment-templates`: lista versões do estúdio autenticado.
- `GET /assessment-templates/:id`: abre uma versão do estúdio autenticado.
- `POST /assessment-templates`: cria um rascunho ou modelo publicado.
- `PATCH /assessment-templates/:id`: atualiza rascunho ou cria nova versão rascunho quando a versão atual está publicada.
- `POST /assessment-templates/:id/publish`: publica após validar uma das três vagas.
- `POST /assessment-templates/:id/archive`: arquiva a versão.
- `POST /assessment-templates/:id/restore`: restaura uma versão publicada se houver vaga.
- `GET /assessment-templates/presets`: lista os dois presets mantidos no código.
- `POST /assessment-templates/presets/:key/copy`: copia um preset para o estúdio como rascunho.

Os presets são `initial_anamnesis` e `physical_evaluation`. Eles não são inseridos automaticamente por seed nem publicados automaticamente.

Respostas guardam `templateVersion`, portanto continuam vinculadas à versão histórica usada no preenchimento. Conteúdo de respostas não deve ser incluído em `AuditLog`.
