"""Gera os arquivos de importação .xlsx usados em specs/teacher-import.spec.ts.

Modelo PROPOSTO (a confirmar com Backend 2 / Frontend 2 — ver e2e/README.md):
  aba "Dados"     → pares chave/valor: Título, Nível, Dificuldade, Enunciado, Dica
  aba "Planilha"  → grade inicial (valores nas células, como o aluno verá)
  aba "Gabarito"  → colunas Célula | Resposta (fórmula como texto, ex.: =SOMA(A1:A3))

Uso: python3 e2e/data/xlsx/build_fixtures.py   (requer openpyxl)
"""
from pathlib import Path

from openpyxl import Workbook

HERE = Path(__file__).parent


def base_workbook(with_answer_key: bool = True) -> Workbook:
    wb = Workbook()
    dados = wb.active
    dados.title = "Dados"
    for row in [
        ("Título", "e2e — Soma importada"),
        ("Nível", "Fundamental"),
        ("Dificuldade", "Muito fácil"),
        ("Enunciado", "Some os valores de A1:A3 na célula A4."),
        ("Dica", "Use a função SOMA com o intervalo A1:A3."),
    ]:
        dados.append(row)
    grade = wb.create_sheet("Planilha")
    for ref, value in {"A1": 10, "A2": 20, "A3": 30}.items():
        grade[ref] = value
    gabarito = wb.create_sheet("Gabarito")
    gabarito.append(("Célula", "Resposta"))
    if with_answer_key:
        gabarito["A2"] = "A4"
        cell = gabarito["B2"]
        cell.value = "=SOMA(A1:A3)"
        cell.data_type = "s"  # guarda a fórmula como texto
    return wb


def main() -> None:
    base_workbook().save(HERE / "exercicio-valido.xlsx")
    base_workbook(with_answer_key=False).save(HERE / "exercicio-sem-gabarito.xlsx")
    # Tudo ou nada: linha 2 do gabarito válida, linha 3 com célula sem resposta.
    wb = base_workbook()
    wb["Gabarito"]["A3"] = "B4"
    wb.save(HERE / "exercicio-gabarito-linha-invalida.xlsx")
    # Corrompido: começa como um .xlsx (zip) válido, mas truncado.
    valid = (HERE / "exercicio-valido.xlsx").read_bytes()
    (HERE / "exercicio-corrompido.xlsx").write_bytes(valid[: len(valid) // 3])
    # Formato errado: CSV com o mesmo conteúdo.
    (HERE / "exercicio-formato-errado.csv").write_text(
        "Célula,Valor\nA1,10\nA2,20\nA3,30\nA4,=SOMA(A1:A3)\n", encoding="utf-8"
    )
    print("fixtures gerados em", HERE)


if __name__ == "__main__":
    main()
