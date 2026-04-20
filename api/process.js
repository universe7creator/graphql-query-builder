// GraphQL Query Builder API
// Provides query formatting, validation, and introspection services

const { buildSchema, validate, parse } = require('graphql');

// CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-License-Key');
};

// Simple GraphQL formatter
function formatGraphQLQuery(query) {
  let indent = 0;
  let result = '';
  let inString = false;
  const indentStr = '  ';

  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    const prevChar = query[i - 1];

    if (char === '"' && prevChar !== '\\') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      result += char;
      continue;
    }

    if (char === '{' || char === '(') {
      result += char + '\n' + indentStr.repeat(++indent);
    } else if (char === '}' || char === ')') {
      result = result.trimEnd();
      result += '\n' + indentStr.repeat(--indent) + char;
    } else if (char === ',') {
      result += char + '\n' + indentStr.repeat(indent);
    } else if (char === '\n' || char === '\r') {
      continue;
    } else if (char === ' ' && (prevChar === ' ' || prevChar === '\n')) {
      continue;
    } else {
      result += char;
    }
  }

  return result.trim();
}

// Validate GraphQL query
function validateGraphQLQuery(query) {
  const errors = [];

  try {
    // Try to parse the query
    const ast = parse(query);

    // Check for common issues
    const lines = query.split('\n');

    // Check for unclosed braces
    const openBraces = (query.match(/\{/g) || []).length;
    const closeBraces = (query.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        message: `Mismatched braces: ${openBraces} opening, ${closeBraces} closing`,
        severity: 'error'
      });
    }

    // Check for unclosed parentheses
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push({
        message: `Mismatched parentheses: ${openParens} opening, ${closeParens} closing`,
        severity: 'error'
      });
    }

    // Check for missing operation type
    if (!query.match(/\b(query|mutation|subscription|fragment)\b/i) && query.includes('{')) {
      errors.push({
        message: 'Query should start with query, mutation, subscription, or fragment keyword',
        severity: 'warning'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      ast: ast ? 'Parsed successfully' : null
    };
  } catch (error) {
    errors.push({
      message: error.message,
      severity: 'error'
    });

    return {
      valid: false,
      errors,
      ast: null
    };
  }
}

// Get query statistics
function getQueryStats(query) {
  const lines = query.split('\n').length;
  const words = query.split(/\s+/).filter(w => w.length > 0).length;
  const fields = (query.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\s*\{/g) || []).length +
                 (query.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g) || []).length;
  const depth = Math.max(...query.split('\n').map(line => {
    let d = 0;
    for (const char of line) {
      if (char === '{') d++;
      if (char === '}') d--;
    }
    return d;
  }), 0);

  return {
    lines,
    words,
    fields,
    estimatedDepth: depth,
    characters: query.length
  };
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, query, options = {} } = req.body || {};

    if (!action) {
      return res.status(400).json({
        error: 'Missing action parameter',
        validActions: ['format', 'validate', 'stats', 'introspect']
      });
    }

    switch (action) {
      case 'format': {
        if (!query) {
          return res.status(400).json({ error: 'Missing query parameter' });
        }

        const formatted = formatGraphQLQuery(query);
        return res.status(200).json({
          success: true,
          original: query,
          formatted,
          stats: getQueryStats(formatted)
        });
      }

      case 'validate': {
        if (!query) {
          return res.status(400).json({ error: 'Missing query parameter' });
        }

        const validation = validateGraphQLQuery(query);
        return res.status(200).json({
          success: true,
          valid: validation.valid,
          errors: validation.errors,
          query: query.substring(0, 500)
        });
      }

      case 'stats': {
        if (!query) {
          return res.status(400).json({ error: 'Missing query parameter' });
        }

        const stats = getQueryStats(query);
        const validation = validateGraphQLQuery(query);

        return res.status(200).json({
          success: true,
          stats,
          validation: {
            valid: validation.valid,
            errorCount: validation.errors.length
          }
        });
      }

      case 'introspect': {
        const { endpoint, headers = {} } = req.body || {};

        if (!endpoint) {
          return res.status(400).json({
            error: 'Missing endpoint parameter',
            message: 'Provide a GraphQL endpoint URL to introspect'
          });
        }

        // In a production environment, this would make an actual HTTP request
        // For now, return a mock response
        return res.status(200).json({
          success: true,
          message: 'Introspection endpoint ready',
          endpoint,
          note: 'Full introspection requires server-side fetch implementation'
        });
      }

      default:
        return res.status(400).json({
          error: 'Unknown action',
          validActions: ['format', 'validate', 'stats', 'introspect'],
          received: action
        });
    }
  } catch (error) {
    console.error('[ERROR] GraphQL API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
