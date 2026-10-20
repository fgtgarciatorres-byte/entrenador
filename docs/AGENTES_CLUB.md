# Agentes de Cancha para un club pequeño

## Agente entrenador

Trabaja con un entrenador. Analiza datos autorizados, prepara sesiones, consulta la biblioteca y guarda observaciones locales por dorsal. No diagnostica, no interviene directamente con menores y no comparte notas privadas.

## Agente club asesor

Mantiene la biblioteca, publica directrices aprobadas, ofrece recursos a los agentes entrenadores y recoge prácticas que el entrenador autorice compartir. Trabaja con indicadores colectivos y no accede a fichas individuales salvo permiso explícito y justificado.

## Agente club organizador

Asesora exclusivamente a la dirección. Lee únicamente indicadores agregados, necesidades formativas y prácticas compartidas. No contacta con entrenadores, no clasifica personas y no recomienda cambios como decisiones automáticas.

## Flujo seguro

1. El entrenador registra una observación local.
2. Revisa y corrige la nota.
3. Decide si comparte una síntesis colectiva.
4. El agente asesor valida que no haya nombres, dorsales ni datos sensibles.
5. El organizador recibe solo el agregado autorizado.
6. La dirección decide y registra la decisión fuera del agente.

La versión publicada implementa la separación de vistas y el modelo de datos del piloto. La autenticación multiusuario y los permisos de servidor quedan pendientes de una fase con backend.
