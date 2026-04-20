module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, headers = {} } = req.body || {};

  if (!endpoint) {
    return res.status(400).json({ error: 'GraphQL endpoint is required' });
  }

  const introspectionQuery = `
    query IntrospectionQuery {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          ...FullType
        }
        directives {
          name
          description
          locations
          args {
            ...InputValue
          }
        }
      }
    }

    fragment FullType on __Type {
      kind
      name
      description
      fields(includeDeprecated: true) {
        name
        description
        args {
          ...InputValue
        }
        type {
          ...TypeRef
        }
        isDeprecated
        deprecationReason
      }
      inputFields {
        ...InputValue
      }
      interfaces {
        ...TypeRef
      }
      enumValues(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        ...TypeRef
      }
    }

    fragment InputValue on __InputValue {
      name
      description
      type { ...TypeRef }
      defaultValue
    }

    fragment TypeRef on __Type {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ query: introspectionQuery })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      return res.status(400).json({
        error: 'Introspection failed',
        details: data.errors
      });
    }

    const schema = data.data.__schema;
    const types = schema.types.filter(t => !t.name.startsWith('__'));
    const queries = schema.queryType
      ? types.find(t => t.name === schema.queryType.name)?.fields || []
      : [];
    const mutations = schema.mutationType
      ? types.find(t => t.name === schema.mutationType.name)?.fields || []
      : [];

    res.status(200).json({
      success: true,
      schema: {
        queryType: schema.queryType?.name,
        mutationType: schema.mutationType?.name,
        subscriptionType: schema.subscriptionType?.name,
        types: types.map(t => ({
          name: t.name,
          kind: t.kind,
          description: t.description
        })),
        queries: queries.map(q => ({
          name: q.name,
          description: q.description,
          args: q.args,
          type: q.type
        })),
        mutations: mutations.map(m => ({
          name: m.name,
          description: m.description,
          args: m.args,
          type: m.type
        })),
        typeCount: types.length,
        queryCount: queries.length,
        mutationCount: mutations.length
      }
    });
  } catch (error) {
    console.error('Introspection error:', error);
    res.status(500).json({
      error: 'Failed to introspect schema',
      message: error.message
    });
  }
};
