// OpenAPI 3 spec y HTML con Scalar UI (interactive docs).
// Scalar carga vía CDN en una sola línea <script>; no agregamos deps al bundle.

export const publicApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Tech Radar LATAM — Public API',
    version: '1.0.0',
    description:
      'API REST de solo lectura para que comunidades tech embeban el catálogo de eventos en sus sitios.\n\nRequiere una API key por comunidad (pide la tuya escribiendo al equipo). Los endpoints públicos están bajo `/public/v1/*`, CORS abierto y con rate limit por key.',
    contact: {
      name: 'Tech Radar LATAM',
      url: 'https://tech-radar-latam.vercel.app'
    },
    license: { name: 'MIT' }
  },
  servers: [
    { url: 'https://tech-radar-api.onrender.com', description: 'Producción' },
    { url: 'http://localhost:4000', description: 'Local dev' }
  ],
  components: {
    securitySchemes: {
      ApiKeyBearer: { type: 'http', scheme: 'bearer' },
      ApiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' }
    },
    schemas: {
      PublicEvent: {
        type: 'object',
        required: ['id', 'title', 'date', 'country', 'city', 'source', 'url', 'tags', 'level', 'summary'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          date: { type: 'string', format: 'date-time' },
          country: { type: 'string' },
          city: { type: 'string' },
          source: { type: 'string', enum: ['meetup', 'eventbrite', 'gdg', 'community'] },
          url: { type: 'string', format: 'uri' },
          link: { type: 'string', nullable: true },
          tags: { type: 'array', items: { type: 'string' } },
          level: { type: 'string', enum: ['junior', 'mid', 'senior', 'all'] },
          summary: { type: 'string' },
          trending: { type: 'boolean' }
        }
      },
      EventsResponse: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          events: { type: 'array', items: { $ref: '#/components/schemas/PublicEvent' } }
        }
      },
      CountriesResponse: {
        type: 'object',
        properties: {
          countries: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, count: { type: 'integer' } }
            }
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  },
  security: [{ ApiKeyBearer: [] }, { ApiKeyHeader: [] }],
  paths: {
    '/public/v1/events': {
      get: {
        summary: 'Lista eventos',
        description: 'Devuelve eventos tech de LATAM con filtros opcionales y paginación.',
        parameters: [
          { name: 'country', in: 'query', schema: { type: 'string' }, example: 'Ecuador' },
          { name: 'city', in: 'query', schema: { type: 'string' }, example: 'Quito' },
          { name: 'source', in: 'query', schema: { type: 'string', enum: ['meetup', 'eventbrite', 'gdg', 'community'] } },
          { name: 'tag', in: 'query', schema: { type: 'string' }, example: 'ia' },
          { name: 'q', in: 'query', description: 'Búsqueda por texto libre (AND entre tokens).', schema: { type: 'string' }, example: 'flutter mobile' },
          { name: 'upcoming', in: 'query', description: 'Si true, sólo eventos futuros.', schema: { type: 'boolean' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } }
        ],
        responses: {
          '200': {
            description: 'Página de eventos filtrados.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EventsResponse' } } }
          },
          '401': { description: 'API key inválida o faltante.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit excedido.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },
    '/public/v1/events/{id}': {
      get: {
        summary: 'Detalle de un evento',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Evento encontrado.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { event: { $ref: '#/components/schemas/PublicEvent' } }
                }
              }
            }
          },
          '404': { description: 'Evento no encontrado.' }
        }
      }
    },
    '/public/v1/countries': {
      get: {
        summary: 'Lista de países con conteo de eventos',
        responses: {
          '200': {
            description: 'Países ordenados por cantidad de eventos.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CountriesResponse' } } }
          }
        }
      }
    },
    '/public/v1/sources': {
      get: {
        summary: 'Lista de fuentes soportadas',
        responses: {
          '200': {
            description: 'IDs y labels de fuentes disponibles.'
          }
        }
      }
    }
  }
};

export function renderDocsPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tech Radar LATAM · API pública</title>
  <style>
    body { margin: 0; background: #0b1020; }
  </style>
</head>
<body>
  <script id="api-reference" data-url="/public/openapi.json"></script>
  <script>
    // Configura tema oscuro para matchear la identidad del producto.
    document.getElementById('api-reference').dataset.configuration = JSON.stringify({
      theme: 'deepSpace',
      layout: 'modern',
      defaultOpenAllTags: true,
      metaData: {
        title: 'Tech Radar LATAM · API pública',
        description: 'API de eventos tech de LATAM para comunidades.'
      }
    });
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}
