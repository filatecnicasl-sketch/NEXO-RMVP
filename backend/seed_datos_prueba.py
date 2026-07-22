"""
Script de datos de prueba para Hemsa - Registro de Vivienda Protegida
Inserta ciudadanos y solicitudes con distintos estados para ver el sistema funcionando.
Ejecutar desde la carpeta backend: python seed_datos_prueba.py
"""
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from pymongo import MongoClient

# --- Conexión ---
client = MongoClient('mongodb://localhost:27017')
db = client['hemsa_local']

def now():
    return datetime.now(timezone.utc)

def fecha(dias_atras=0):
    return (now() - timedelta(days=dias_atras)).isoformat()

def hash_pw(pw):
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

# ─────────────────────────────────────────────
# 1. CIUDADANOS (usuarios)
# ─────────────────────────────────────────────
ciudadanos = [
    {
        'user_id': 'user_prueba_001',
        'email': 'maria.garcia@example.com',
        'name': 'María García Fernández',
        'role': 'citizen',
        'auth_provider': 'password',
        'password_hash': hash_pw('Vecino123!'),
        'disabled': False,
        'created_at': fecha(120),
    },
    {
        'user_id': 'user_prueba_002',
        'email': 'antonio.lopez@example.com',
        'name': 'Antonio López Martínez',
        'role': 'citizen',
        'auth_provider': 'password',
        'password_hash': hash_pw('Vecino123!'),
        'disabled': False,
        'created_at': fecha(90),
    },
    {
        'user_id': 'user_prueba_003',
        'email': 'carmen.ruiz@example.com',
        'name': 'Carmen Ruiz Sánchez',
        'role': 'citizen',
        'auth_provider': 'password',
        'password_hash': hash_pw('Vecino123!'),
        'disabled': False,
        'created_at': fecha(60),
    },
    {
        'user_id': 'user_prueba_004',
        'email': 'jose.moreno@example.com',
        'name': 'José Moreno Díaz',
        'role': 'citizen',
        'auth_provider': 'password',
        'password_hash': hash_pw('Vecino123!'),
        'disabled': False,
        'created_at': fecha(45),
    },
    {
        'user_id': 'user_prueba_005',
        'email': 'ana.jimenez@example.com',
        'name': 'Ana Jiménez Torres',
        'role': 'citizen',
        'auth_provider': 'password',
        'password_hash': hash_pw('Vecino123!'),
        'disabled': False,
        'created_at': fecha(30),
    },
    {
        'user_id': 'user_prueba_006',
        'email': 'francisco.hernandez@example.com',
        'name': 'Francisco Hernández Vega',
        'role': 'citizen',
        'auth_provider': 'password',
        'password_hash': hash_pw('Vecino123!'),
        'disabled': False,
        'created_at': fecha(20),
    },
    {
        'user_id': 'user_prueba_007',
        'email': 'laura.perez@example.com',
        'name': 'Laura Pérez Castillo',
        'role': 'citizen',
        'auth_provider': 'password',
        'password_hash': hash_pw('Vecino123!'),
        'disabled': False,
        'created_at': fecha(10),
    },
]

# Insertar ciudadanos (upsert por email)
for c in ciudadanos:
    db.users.update_one({'email': c['email']}, {'$set': c}, upsert=True)
    print(f"  Ciudadano: {c['name']}")

# También un admin adicional de nivel lector
db.users.update_one(
    {'email': 'tecnico@hemsa.es'},
    {'$set': {
        'user_id': 'user_admin_lector',
        'email': 'tecnico@hemsa.es',
        'name': 'Técnico Lector',
        'role': 'admin',
        'admin_level': 'lector',
        'auth_provider': 'password',
        'password_hash': hash_pw('Tecnico123!'),
        'disabled': False,
        'created_at': fecha(200),
    }},
    upsert=True
)
print("  Admin lector: tecnico@hemsa.es / Tecnico123!")

# ─────────────────────────────────────────────
# 2. SOLICITUDES
# ─────────────────────────────────────────────
def titular(nombre, apellido1, apellido2, dni, nacimiento, ingresos, sexo='M'):
    return {
        'nombre': nombre,
        'apellido1': apellido1,
        'apellido2': apellido2,
        'sexo': sexo,
        'tipo_documento': 'DNI',
        'numero_documento': dni,
        'nacionalidad': 'Española',
        'fecha_nacimiento': nacimiento,
        'empadronado_en': 'San Fernando',
        'direccion': 'Calle Real 12, San Fernando',
        'domicilio': 'Calle Real 12',
        'telefono_fijo': '',
        'telefono_movil': '600' + str(int(dni[:6]) % 1000000).zfill(6),
        'codigo_postal': '11100',
        'email': '',
        'ingresos_economicos': ingresos,
        'tipo_declaracion_irpf': 'INDIVIDUAL',
        'anio_ingresos': 2024,
        'grupos_acreditacion': [],
    }

solicitudes = [
    # 1 — Aprobada con puntuación alta
    {
        'application_id': 'app_prueba_001',
        'user_id': 'user_prueba_001',
        'numero_registro': 'REG-2025-0001',
        'status': 'aprobada',
        'created_at': fecha(110),
        'updated_at': fecha(80),
        'score': 85,
        'score_adjustment': 0,
        'score_adjustment_reason': '',
        'admin_notes': [
            {'texto': 'Documentación completa y correcta. Solicitud prioritaria.', 'created_at': fecha(85), 'author': 'Administrador Hemsa'},
        ],
        'titular1': titular('María', 'García', 'Fernández', '12345678A', '1985-03-15', 18000, 'F'),
        'titular2': None,
        'otros_miembros': [
            {'nombre_completo': 'Lucas García Fernández', 'nif': '', 'fecha_nacimiento': '2010-06-20', 'nacionalidad': 'Española', 'sexo': 'M', 'ingresos_economicos': 0, 'tipo_declaracion': 'No la Hace', 'anio_ingresos': 2024, 'grupos_acreditacion': ['JOV']},
        ],
        'vivienda': {
            'regimen': ['Alquiler'],
            'dormitorios': ['2'],
            'silla_ruedas': False, 'movilidad_reducida': False, 'cooperativa': False,
            'alojamiento_otros_familiares': False, 'vivienda_inadecuada_superficie': True,
            'renta_elevada': False, 'necesidad_vivienda_adaptada': False,
            'precariedad': True, 'nueva_unidad_familiar': False, 'otros': False, 'otros_detalle': '',
        },
        'justificacion': {'casillas': ['RUI', 'DES']},
        'declaracion': {'motivo_propiedad': '', 'inscripcion_otros_municipios': 'No', 'preferencia_en': 'San Fernando', 'autoriza_email': True, 'autoriza_sms': True},
        'numero_registro_previo': None,
    },

    # 2 — En revisión
    {
        'application_id': 'app_prueba_002',
        'user_id': 'user_prueba_002',
        'numero_registro': 'REG-2025-0002',
        'status': 'en_revision',
        'created_at': fecha(85),
        'updated_at': fecha(40),
        'score': 62,
        'score_adjustment': 5,
        'score_adjustment_reason': 'Bonificación por familia numerosa',
        'admin_notes': [
            {'texto': 'Pendiente de verificar ingresos del segundo titular.', 'created_at': fecha(42), 'author': 'Administrador Hemsa'},
        ],
        'titular1': titular('Antonio', 'López', 'Martínez', '23456789B', '1978-11-02', 22000),
        'titular2': titular('Rosa', 'Vega', 'Ruiz', '34567890C', '1980-04-18', 14000, 'F'),
        'otros_miembros': [
            {'nombre_completo': 'Paula López Vega', 'nif': '', 'fecha_nacimiento': '2008-01-10', 'nacionalidad': 'Española', 'sexo': 'F', 'ingresos_economicos': 0, 'tipo_declaracion': 'No la Hace', 'anio_ingresos': 2024, 'grupos_acreditacion': []},
            {'nombre_completo': 'Carlos López Vega', 'nif': '', 'fecha_nacimiento': '2012-09-25', 'nacionalidad': 'Española', 'sexo': 'M', 'ingresos_economicos': 0, 'tipo_declaracion': 'No la Hace', 'anio_ingresos': 2024, 'grupos_acreditacion': []},
            {'nombre_completo': 'Elena López Vega', 'nif': '', 'fecha_nacimiento': '2018-07-03', 'nacionalidad': 'Española', 'sexo': 'F', 'ingresos_economicos': 0, 'tipo_declaracion': 'No la Hace', 'anio_ingresos': 2024, 'grupos_acreditacion': []},
        ],
        'vivienda': {
            'regimen': ['Alquiler', 'Propiedad'],
            'dormitorios': ['3'],
            'silla_ruedas': False, 'movilidad_reducida': False, 'cooperativa': False,
            'alojamiento_otros_familiares': True, 'vivienda_inadecuada_superficie': True,
            'renta_elevada': True, 'necesidad_vivienda_adaptada': False,
            'precariedad': False, 'nueva_unidad_familiar': False, 'otros': False, 'otros_detalle': '',
        },
        'justificacion': {'casillas': ['FMP', 'RUI']},
        'declaracion': {'motivo_propiedad': '', 'inscripcion_otros_municipios': 'No', 'preferencia_en': 'San Fernando', 'autoriza_email': True, 'autoriza_sms': False},
        'numero_registro_previo': None,
    },

    # 3 — Pendiente reciente
    {
        'application_id': 'app_prueba_003',
        'user_id': 'user_prueba_003',
        'numero_registro': 'REG-2025-0003',
        'status': 'pendiente',
        'created_at': fecha(55),
        'updated_at': fecha(55),
        'score': 48,
        'score_adjustment': 0,
        'score_adjustment_reason': '',
        'admin_notes': [],
        'titular1': titular('Carmen', 'Ruiz', 'Sánchez', '45678901D', '1992-07-30', 16500, 'F'),
        'titular2': None,
        'otros_miembros': [],
        'vivienda': {
            'regimen': ['Alquiler con opción a compra'],
            'dormitorios': ['1'],
            'silla_ruedas': False, 'movilidad_reducida': False, 'cooperativa': False,
            'alojamiento_otros_familiares': False, 'vivienda_inadecuada_superficie': False,
            'renta_elevada': True, 'necesidad_vivienda_adaptada': False,
            'precariedad': False, 'nueva_unidad_familiar': True, 'otros': False, 'otros_detalle': '',
        },
        'justificacion': {'casillas': ['JOV', 'RUI']},
        'declaracion': {'motivo_propiedad': '', 'inscripcion_otros_municipios': 'No', 'preferencia_en': 'San Fernando', 'autoriza_email': True, 'autoriza_sms': True},
        'numero_registro_previo': None,
    },

    # 4 — Denegada
    {
        'application_id': 'app_prueba_004',
        'user_id': 'user_prueba_004',
        'numero_registro': 'REG-2025-0004',
        'status': 'denegada',
        'created_at': fecha(40),
        'updated_at': fecha(15),
        'score': 20,
        'score_adjustment': 0,
        'score_adjustment_reason': '',
        'admin_notes': [
            {'texto': 'Ingresos superan el límite establecido para vivienda protegida.', 'created_at': fecha(18), 'author': 'Administrador Hemsa'},
            {'texto': 'Se notifica al solicitante por correo electrónico.', 'created_at': fecha(15), 'author': 'Administrador Hemsa'},
        ],
        'titular1': titular('José', 'Moreno', 'Díaz', '56789012E', '1975-02-14', 42000),
        'titular2': titular('Isabel', 'Castro', 'Mena', '67890123F', '1977-09-22', 38000, 'F'),
        'otros_miembros': [],
        'vivienda': {
            'regimen': ['Propiedad'],
            'dormitorios': ['2', '3'],
            'silla_ruedas': False, 'movilidad_reducida': False, 'cooperativa': False,
            'alojamiento_otros_familiares': False, 'vivienda_inadecuada_superficie': False,
            'renta_elevada': False, 'necesidad_vivienda_adaptada': False,
            'precariedad': False, 'nueva_unidad_familiar': False, 'otros': False, 'otros_detalle': '',
        },
        'justificacion': {'casillas': []},
        'declaracion': {'motivo_propiedad': 'Vivienda vendida', 'inscripcion_otros_municipios': 'No', 'preferencia_en': 'San Fernando', 'autoriza_email': True, 'autoriza_sms': True},
        'numero_registro_previo': None,
    },

    # 5 — Pendiente con discapacidad
    {
        'application_id': 'app_prueba_005',
        'user_id': 'user_prueba_005',
        'numero_registro': 'REG-2025-0005',
        'status': 'pendiente',
        'created_at': fecha(28),
        'updated_at': fecha(28),
        'score': 73,
        'score_adjustment': 10,
        'score_adjustment_reason': 'Discapacidad reconocida >65%',
        'admin_notes': [],
        'titular1': titular('Ana', 'Jiménez', 'Torres', '78901234G', '1968-12-05', 11000, 'F'),
        'titular2': None,
        'otros_miembros': [],
        'vivienda': {
            'regimen': ['Alquiler'],
            'dormitorios': ['1'],
            'silla_ruedas': True, 'movilidad_reducida': True, 'cooperativa': False,
            'alojamiento_otros_familiares': False, 'vivienda_inadecuada_superficie': True,
            'renta_elevada': False, 'necesidad_vivienda_adaptada': True,
            'precariedad': True, 'nueva_unidad_familiar': False, 'otros': False, 'otros_detalle': '',
        },
        'justificacion': {'casillas': ['DIS', 'RUI', 'DES']},
        'declaracion': {'motivo_propiedad': '', 'inscripcion_otros_municipios': 'No', 'preferencia_en': 'San Fernando', 'autoriza_email': True, 'autoriza_sms': True},
        'numero_registro_previo': None,
    },

    # 6 — En revisión reciente
    {
        'application_id': 'app_prueba_006',
        'user_id': 'user_prueba_006',
        'numero_registro': 'REG-2025-0006',
        'status': 'en_revision',
        'created_at': fecha(18),
        'updated_at': fecha(5),
        'score': 55,
        'score_adjustment': 0,
        'score_adjustment_reason': '',
        'admin_notes': [
            {'texto': 'Solicitud de subsanación enviada al ciudadano.', 'created_at': fecha(5), 'author': 'Administrador Hemsa'},
        ],
        'titular1': titular('Francisco', 'Hernández', 'Vega', '89012345H', '1990-08-19', 19500),
        'titular2': None,
        'otros_miembros': [
            {'nombre_completo': 'Sofía Hernández Blanco', 'nif': '', 'fecha_nacimiento': '2015-03-11', 'nacionalidad': 'Española', 'sexo': 'F', 'ingresos_economicos': 0, 'tipo_declaracion': 'No la Hace', 'anio_ingresos': 2024, 'grupos_acreditacion': []},
        ],
        'vivienda': {
            'regimen': ['Alquiler'],
            'dormitorios': ['2'],
            'silla_ruedas': False, 'movilidad_reducida': False, 'cooperativa': True,
            'alojamiento_otros_familiares': False, 'vivienda_inadecuada_superficie': False,
            'renta_elevada': True, 'necesidad_vivienda_adaptada': False,
            'precariedad': False, 'nueva_unidad_familiar': False, 'otros': False, 'otros_detalle': '',
        },
        'justificacion': {'casillas': ['FMP', 'JOV']},
        'declaracion': {'motivo_propiedad': '', 'inscripcion_otros_municipios': 'No', 'preferencia_en': 'San Fernando', 'autoriza_email': True, 'autoriza_sms': True},
        'numero_registro_previo': None,
    },

    # 7 — Pendiente muy reciente
    {
        'application_id': 'app_prueba_007',
        'user_id': 'user_prueba_007',
        'numero_registro': 'REG-2025-0007',
        'status': 'pendiente',
        'created_at': fecha(3),
        'updated_at': fecha(3),
        'score': 38,
        'score_adjustment': 0,
        'score_adjustment_reason': '',
        'admin_notes': [],
        'titular1': titular('Laura', 'Pérez', 'Castillo', '90123456I', '1995-05-28', 14000, 'F'),
        'titular2': None,
        'otros_miembros': [],
        'vivienda': {
            'regimen': ['Alquiler'],
            'dormitorios': ['1'],
            'silla_ruedas': False, 'movilidad_reducida': False, 'cooperativa': False,
            'alojamiento_otros_familiares': True, 'vivienda_inadecuada_superficie': False,
            'renta_elevada': False, 'necesidad_vivienda_adaptada': False,
            'precariedad': False, 'nueva_unidad_familiar': True, 'otros': False, 'otros_detalle': '',
        },
        'justificacion': {'casillas': ['JOV']},
        'declaracion': {'motivo_propiedad': '', 'inscripcion_otros_municipios': 'No', 'preferencia_en': 'San Fernando', 'autoriza_email': True, 'autoriza_sms': True},
        'numero_registro_previo': None,
    },
]

# Insertar solicitudes (upsert por application_id)
for s in solicitudes:
    db.applications.update_one(
        {'application_id': s['application_id']},
        {'$set': s},
        upsert=True
    )
    print(f"  Solicitud {s['numero_registro']} — {s['status']} — puntuación: {s['score']}")

print()
print("=" * 55)
print("DATOS DE PRUEBA CARGADOS CORRECTAMENTE")
print("=" * 55)
print()
print("USUARIOS ADMINISTRADOR:")
print("  admin@hemsa.es        / AdminHemsa2026!   (gerente)")
print("  tecnico@hemsa.es      / Tecnico123!       (lector)")
print()
print("CIUDADANOS (todos con contraseña: Vecino123!):")
for c in ciudadanos:
    print(f"  {c['email']}")
print()
print("SOLICITUDES INSERTADAS: 7")
print("  Aprobadas:    1  (REG-2025-0001)")
print("  En revisión:  2  (REG-2025-0002, REG-2025-0006)")
print("  Pendientes:   3  (REG-2025-0003, REG-2025-0005, REG-2025-0007)")
print("  Denegadas:    1  (REG-2025-0004)")
