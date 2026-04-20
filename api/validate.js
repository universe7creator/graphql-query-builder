module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, endpoint, headers = {} } = req.body || {};

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  // Basic GraphQL syntax validation
  const validation = validateGraphQL(query);

  if (!validation.valid) {
    return res.status(400).json({
      valid: false,
      errors: validation.errors
    });
  }

  // If endpoint provided, try to execute the query
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();

      return res.status(200).json({
        valid: true,
        errors: [],
        execution: data
      });
    } catch (error) {
      return res.status(500).json({
        valid: true,
        errors: [],
        execution: { error: error.message }
      });
    }
  }

  res.status(200).json({
    valid: true,
    errors: []
  });
};

function validateGraphQL(query) {
  const errors = [];

  // Check for query/mutation/subscription keyword
  const hasOperation = /\b(query|mutation|subscription)\b/i.test(query);
  const hasBraces = query.includes('{') && query.includes('}');

  if (!hasOperation && !hasBraces) {
    errors.push('Query must start with query, mutation, or subscription, or contain a selection set');
  }

  // Check brace matching
  const openBraces = (query.match(/\{/g) || []).length;
  const closeBraces = (query.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Mismatched braces: ${openBraces} opening, ${closeBraces} closing`);
  }

  // Check parenthesis matching
  const openParens = (query.match(/\(/g) || []).length;
  const closeParens = (query.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Mismatched parentheses: ${openParens} opening, ${closeParens} closing`);
  }

  // Check bracket matching (for arrays)
  const openBrackets = (query.match(/\[/g) || []).length;
  const closeBrackets = (query.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push(`Mismatched brackets: ${openBrackets} opening, ${closeBrackets} closing`);
  }

  // Check for unclosed strings
  let inString = false;
  let stringChar = null;
  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    const prevChar = i > 0 ? query[i - 1] : null;

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      stringChar = null;
    }
  }
  if (inString) {
    errors.push('Unclosed string literal');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
