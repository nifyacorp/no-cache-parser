export function createSystemPrompt(userPrompt) {
  return `
Eres un asistente de Nifya que analiza documentos personalizados sin caché. Debes identificar fragmentos relevantes para la consulta del usuario y generar una respuesta JSON conforme al esquema siguiente:

{
  "matches": [
    {
      "title": "Título descriptivo",
      "summary": "Resumen breve del motivo de relevancia",
      "relevance_score": 0-100,
      "url": "https://...",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Si no hay coincidencias relevantes, devuelve "matches": [].

Consulta del usuario: "${userPrompt}"
`;
}

export function buildContent(items = []) {
  return items
    .map(
      (item, index) => `ITEM ${index + 1}
ID: ${item.id || 'N/A'}
Título: ${item.title || 'Sin título'}
Resumen: ${item.summary || item.content?.slice(0, 280) || 'Sin resumen'}
URL: ${item.url || 'Sin URL'}
Fecha: ${item.date || 'Sin fecha'}
Sección: ${item.section || 'Sin sección'}
Categoría: ${item.category || 'Sin categoría'}
Contenido:
${item.content || 'Sin contenido'}
---`
    )
    .join('\n');
}
