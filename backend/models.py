"""Pydantic models for the Hemsa registry application."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr


class CitizenRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class CitizenLogin(BaseModel):
    email: EmailStr
    password: str


class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleSession(BaseModel):
    session_id: str


class Holder(BaseModel):
    nombre: str = ""
    apellido1: str = ""
    apellido2: str = ""
    sexo: str = ""
    tipo_documento: str = "DNI"
    numero_documento: str = ""
    nacionalidad: str = "Española"
    fecha_nacimiento: str = ""
    empadronado_en: str = "San Fernando"
    direccion: str = ""
    domicilio: str = ""
    telefono_fijo: str = ""
    telefono_movil: str = ""
    codigo_postal: str = ""
    email: str = ""
    ingresos_economicos: float = 0
    tipo_declaracion_irpf: str = "INDIVIDUAL"
    anio_ingresos: int = 2024
    grupos_acreditacion: List[str] = []


class OtroMiembro(BaseModel):
    nombre_completo: str
    nif: str = ""
    fecha_nacimiento: str = ""
    nacionalidad: str = "Española"
    sexo: str = ""
    ingresos_economicos: float = 0
    tipo_declaracion: str = "No la Hace"
    anio_ingresos: int = 2024
    grupos_acreditacion: List[str] = []


class Vivienda(BaseModel):
    regimen: List[str] = []          # Propiedad | Alquiler | Alquiler con opción a compra
    dormitorios: List[str] = []      # 1 | 2 | 3 | 4
    silla_ruedas: bool = False
    movilidad_reducida: bool = False
    cooperativa: bool = False
    alojamiento_otros_familiares: bool = False
    vivienda_inadecuada_superficie: bool = False
    renta_elevada: bool = False
    necesidad_vivienda_adaptada: bool = False
    precariedad: bool = False
    nueva_unidad_familiar: bool = False
    otros: bool = False
    otros_detalle: str = ""


class Justificacion(BaseModel):
    casillas: List[str] = []   # códigos como "RUI","DES","FMP","JOV"...


class DeclaracionResponsable(BaseModel):
    motivo_propiedad: str = ""
    inscripcion_otros_municipios: str = ""
    preferencia_en: str = ""
    autoriza_email: bool = True
    autoriza_sms: bool = True


class ApplicationCreate(BaseModel):
    titular1: Holder
    titular2: Optional[Holder] = None
    otros_miembros: List[OtroMiembro] = []
    vivienda: Vivienda
    justificacion: Justificacion
    declaracion: DeclaracionResponsable
    numero_registro_previo: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str   # pendiente | en_revision | aprobada | denegada
    nota: Optional[str] = None


class AdminNote(BaseModel):
    texto: str


class ScoreAdjustment(BaseModel):
    points: int
    reason: str = ""


class BaremoConfig(BaseModel):
    casillas: Dict[str, int]
    vivienda_flags: Dict[str, int]
    income_brackets: List[Dict[str, Any]]
    miembros_per_person: int
    miembros_max_bonus: int


class AlegacionCreate(BaseModel):
    texto: str
    attachment_ids: List[str] = []


class AlegacionResponse(BaseModel):
    texto: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "admin"  # admin | citizen
    admin_level: Optional[str] = None  # gerente | administracion | lector (only for admin role)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    admin_level: Optional[str] = None
    disabled: Optional[bool] = None


class PasswordReset(BaseModel):
    new_password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class SubsanacionCreate(BaseModel):
    motivo: str
    proposed_data: ApplicationCreate


class SubsanacionReject(BaseModel):
    motivo: str


class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPasswordPayload(BaseModel):
    token: str
    new_password: str
