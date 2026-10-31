"""
Configuración de tests: desactiva el rate limiting ANTES de importar la app
(los tests hacen decenas de registros y superarían los límites por minuto).
"""

import os

os.environ["RATE_LIMIT_ENABLED"] = "false"
