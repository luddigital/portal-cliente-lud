"""Gera lib/regrasCopyLud.ts com as regras das skills de copy da Lud.
(briefing-copy, copy-guide, transforma-copy, revisao-copy). Rode de novo quando a melhoria
contínua atualizar essas skills:
  python3 scripts/gerar-regras-copy.py <pasta-das-skills> [<pasta-da-skill-criar-copy-completo>]
O criar-copy-completo entra primeiro: é o racional que o ajuste segue."""
import json, sys, pathlib, datetime
base = pathlib.Path(sys.argv[1])
partes = []
if len(sys.argv) > 2:
    txt = (pathlib.Path(sys.argv[2]) / 'SKILL.md').read_text()
    if txt.startswith('---'):
        txt = txt.split('---', 2)[2]
    partes.append(f'### SKILL criar-copy-completo (racional do método)\n{txt.strip()}')
for nome in ['briefing-copy', 'copy-guide', 'transforma-copy', 'revisao-copy']:
    txt = (base / nome / 'SKILL.md').read_text()
    if txt.startswith('---'):
        txt = txt.split('---', 2)[2]
    partes.append(f'### SKILL {nome}\n{txt.strip()}')
corpo = '\n\n'.join(partes)
out = pathlib.Path(__file__).resolve().parent.parent / 'lib' / 'regrasCopyLud.ts'
out.write_text(
    '/** Regras de copy da Lud. copiadas das skills criar-copy-completo, briefing-copy, copy-guide, transforma-copy e revisao-copy.\n'
    f' *  Gerado por scripts/gerar-regras-copy.py em {datetime.date.today().isoformat()}. Não editar à mão. */\n'
    f'export const REGRAS_COPY_LUD = {json.dumps(corpo, ensure_ascii=False)};\n'
)
print(out, len(corpo))
