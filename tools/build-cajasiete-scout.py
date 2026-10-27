"""Build the Cajasiete scouting JSON from the organised local statistics folder.

This importer keeps the source filenames, deduplicates identical match records,
and exposes only dorsal-based signals for the rival.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


TABLE = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
TEXT = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"


def cell_text(cell: ET.Element) -> str:
    return " ".join("".join(p.itertext()).strip() for p in cell.findall(f".//{TEXT}p") if "".join(p.itertext()).strip())


def ods_rows(path: Path) -> list[list[str]]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("content.xml"))
    rows: list[list[str]] = []
    for row in root.findall(f".//{TABLE}table-row"):
        values: list[str] = []
        for cell in row.findall(f"{TABLE}table-cell"):
            value = cell_text(cell)
            repeat = int(cell.attrib.get(f"{TABLE}number-columns-repeated", "1"))
            values.extend([value] * repeat)
        if any(values):
            rows.append(values)
    return rows


def title_from_rows(rows: list[list[str]]) -> str:
    for row in rows[:6]:
        text = " ".join(x for x in row if x)
        if "Estad" in text and "Cadete" in text:
            return text
    return ""


def match_teams(title: str) -> tuple[str, str]:
    match = re.search(r"Estad.{0,10}?\s*-\s*(.*?)\s+vs\s+(.*?)\s+-\s+Cadete", title)
    return (match.group(1).strip(), match.group(2).strip()) if match else ("", "")


def score_rows(rows: list[list[str]], teams: tuple[str, str]) -> tuple[int | None, int | None]:
    scores: list[int] = []
    for row in rows:
        if "TOTALES" not in row:
            continue
        for value in row:
            if re.fullmatch(r"\d{1,3}", value or ""):
                number = int(value)
                if 0 <= number <= 200:
                    scores.append(number)
                    break
    return (scores[0], scores[1]) if len(scores) >= 2 else (None, None)


def player_signals(rows: list[list[str]], team: str) -> list[dict[str, int]]:
    signals: list[dict[str, int]] = []
    in_team = False
    for row in rows:
        line = " ".join(row)
        if line.strip().lower() == team.strip().lower():
            in_team = True
            continue
        if in_team and "TC 2P" in line:
            continue
        if in_team and "TOTALES" in row:
            break
        if not in_team or len(row) < 4:
            continue
        dorsal = next((int(x) for x in row[:3] if re.fullmatch(r"\d{1,3}", x or "")), None)
        points = next((int(x) for x in row[3:8] if re.fullmatch(r"\d{1,3}", x or "")), None)
        if dorsal is not None and points is not None and points > 0:
            signals.append({"dorsal": dorsal, "points": points})
    return sorted(signals, key=lambda x: (-x["points"], x["dorsal"]))[:5]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    files = sorted(args.source.glob("caja7*.ods")) + sorted(args.source.glob("estadisticaPartido_27102026*.xlsx"))
    matches = []
    seen = set()
    all_signals = []
    source_files = []
    for path in files:
        source_files.append(path.name)
        if path.suffix.lower() == ".ods":
            rows = ods_rows(path)
        else:
            # XLSX copies are kept as source evidence; their equivalent ODS files
            # are the canonical records for this local import.
            continue
        title = title_from_rows(rows)
        home, away = match_teams(title)
        home_points, away_points = score_rows(rows, (home, away))
        if not home or not away or home_points is None or away_points is None:
            continue
        key = (home, away, home_points, away_points)
        if key in seen:
            continue
        seen.add(key)
        match = {"date": None, "opponent": away, "teamPoints": home_points, "opponentPoints": away_points, "source": path.name}
        if "Cajasiete" not in home:
            match = {"date": None, "opponent": home, "teamPoints": away_points, "opponentPoints": home_points, "source": path.name}
        matches.append(match)
        if "Cajasiete" in home:
            all_signals.extend(player_signals(rows, home))
        else:
            all_signals.extend(player_signals(rows, away))

    # Keep the strongest dorsal signals by maximum observed points.
    signal_map: dict[int, int] = {}
    for signal in all_signals:
        signal_map[signal["dorsal"]] = max(signal_map.get(signal["dorsal"], 0), signal["points"])
    signals = [{"dorsal": d, "points": p} for d, p in signal_map.items()]
    signals.sort(key=lambda x: (-x["points"], x["dorsal"]))
    signals = signals[:8]
    matches.sort(key=lambda x: (x["opponent"], x["teamPoints"], x["opponentPoints"]))
    payload = {
        "team": "Cajasiete Fundación CB Canarias",
        "category": "Cadete A Femenina · Competición Autonómica · FCB 2026/27",
        "role": "next-opponent-scouting",
        "sourceType": "estadísticas locales FCB entregadas para el proyecto",
        "sourceFiles": source_files,
        "lastVerifiedMatchday": "2026-10-27",
        "coverage": "Seis partidos únicos de Cajasiete; se conservan las fuentes duplicadas y se excluyen de los promedios repetidos.",
        "matches": matches,
        "signalsToVerify": signals,
        "trainingPlan": [
            {"title": "Defensa sobre referencias anotadoras", "duration": "20 min", "evidence": "Los partidos locales permiten identificar dorsales anotadores, no posiciones ni roles permanentes.", "blocks": ["5x5 con comunicación en ayudas", "Cambios de asignación tras bloqueo", "Registrar tiros y finalizaciones del dorsal observado"]},
            {"title": "Control del rebote y transición", "duration": "20 min", "evidence": "Las actas muestran resultados y tiro, pero los campos de rebote y pérdidas del rival son incompletos.", "blocks": ["Bloqueo de rebote tras cada tiro", "Primer pase seguro", "Parar balón después de pérdida"]},
            {"title": "Ataque ante defensa cerrada", "duration": "20 min", "evidence": "La estrategia se mantiene colectiva hasta confirmar el comportamiento de Cajasiete en pista.", "blocks": ["Invertir balón", "Pase extra antes de penetrar", "Escenario igualado con palabra clave"]},
        ],
        "matchStrategy": {
            "objective": "Reducir pérdidas, cerrar el rebote y llegar a las referencias anotadoras sin fijar emparejamientos solo por una muestra local.",
            "comparison": ["Cajasiete dispone de seis partidos únicos en la carpeta organizada.", "Sus marcadores disponibles son suficientes para preparar observación y tiro, pero no para comparar todos los campos: rebotes, asistencias y pérdidas aparecen incompletos.", "La comparación del equipo propio debe usar las actas de Canterbury cargadas por separado."],
            "openingPlan": ["Observar durante los primeros cinco minutos quién inicia el ataque y qué dorsales concentran los tiros.", "Cerrar el rebote en cada lanzamiento.", "Tras pérdida, parar balón y comunicar la primera ayuda.", "En ataque, usar pase extra y salida segura ante presión."],
            "ifThen": ["Si presiona a toda pista, usar dos apoyos y recepción intermedia.", "Si defiende cerrado, invertir el balón y evitar penetraciones forzadas.", "Si aparece una referencia anotadora, ajustar después de observar zonas y finalizaciones.", "Si el partido se iguala, ejecutar una acción entrenada."],
            "observe": ["Presión sobre el primer pase.", "Dorsales que asumen más tiros.", "Rebotes ofensivos concedidos.", "Pérdidas propias ante presión.", "Respuesta tras error."],
            "limits": "Los dorsales son señales de observación de los archivos locales; no son una valoración permanente de jugadoras. Confirmar acta, fecha y categoría antes del partido."
        }
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(files), "uniqueMatches": len(matches), "signals": len(signals), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
