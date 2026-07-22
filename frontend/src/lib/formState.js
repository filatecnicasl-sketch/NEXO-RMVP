// Helpers and initial state for the application form
import { GRUPOS_CODIGOS } from "@/constants/options";

export const emptyTitular = () => ({
  nombre: "",
  apellido1: "",
  apellido2: "",
  sexo: "",
  tipo_documento: "DNI",
  numero_documento: "",
  nacionalidad: "Española",
  fecha_nacimiento: "",
  empadronado_en: "San Fernando",
  direccion: "",
  domicilio: "",
  telefono_fijo: "",
  telefono_movil: "",
  codigo_postal: "",
  email: "",
  ingresos_economicos: 0,
  tipo_declaracion_irpf: "INDIVIDUAL",
  anio_ingresos: 2024,
  grupos_acreditacion: [],
});

export const emptyMiembro = () => ({
  nombre_completo: "",
  nif: "",
  fecha_nacimiento: "",
  nacionalidad: "Española",
  sexo: "",
  ingresos_economicos: 0,
  tipo_declaracion: "No la Hace",
  anio_ingresos: 2024,
  grupos_acreditacion: [],
});

export const emptyVivienda = () => ({
  regimen: [],
  dormitorios: [],
  silla_ruedas: false,
  movilidad_reducida: false,
  cooperativa: false,
  alojamiento_otros_familiares: false,
  vivienda_inadecuada_superficie: false,
  renta_elevada: false,
  necesidad_vivienda_adaptada: false,
  precariedad: false,
  nueva_unidad_familiar: false,
  otros: false,
  otros_detalle: "",
});

export const emptyJustificacion = () => ({ casillas: [] });

export const emptyDeclaracion = () => ({
  motivo_propiedad: "",
  inscripcion_otros_municipios: "",
  preferencia_en: "",
  autoriza_email: true,
  autoriza_sms: true,
});

export const initialFormState = () => ({
  titular1: emptyTitular(),
  titular2: null,
  otros_miembros: [],
  vivienda: emptyVivienda(),
  justificacion: emptyJustificacion(),
  declaracion: emptyDeclaracion(),
});

export function validateTitular1(t) {
  if (!t.nombre.trim()) return "Nombre del Titular 1 obligatorio";
  if (!t.apellido1.trim()) return "Primer apellido del Titular 1 obligatorio";
  if (!t.numero_documento.trim()) return "Documento del Titular 1 obligatorio";
  if (!t.email.trim()) return "Email del Titular 1 obligatorio";
  if (!t.telefono_movil.trim()) return "Teléfono móvil del Titular 1 obligatorio";
  return null;
}

export function validateVivienda(v) {
  if ((v.regimen || []).length === 0) return "Seleccione al menos un régimen de vivienda";
  if ((v.dormitorios || []).length === 0) return "Seleccione al menos un número de dormitorios";
  return null;
}

export { GRUPOS_CODIGOS };
