module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { operation, fields, variables, fragments, endpoint, headers = {} } = req.body || {};

  if (!operation || !fields) {
    return res.status(400).json({ error: 'Operation and fields are required' });
  }

  // Build the query
  let query = '';

  // Add fragments if provided
  if (fragments && fragments.length > 0) {
    fragments.forEach(fragment => {
      query += `fragment ${fragment.name} on ${fragment.type} {\n`;
      query += formatFields(fragment.fields, 1);
      query += '}\n\n';
    });
  }

  // Add operation
  query += operation.type;

  if (operation.name) {
    query += ` ${operation.name}`;
  }

  // Add variables
  if (variables && variables.length > 0) {
    query += '(';
    query += variables.map(v => `$${v.name}: ${v.type}${v.defaultValue ? ` = ${v.defaultValue}` : ''}`).join(', ');
    query += ')';
  }

  query += ' {\n';
  query += formatFields(fields, 1);
  query += '}';

  // If endpoint provided, execute the query
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ query, variables: operation.variableValues })
      });

      const data = await response.json();

      return res.status(200).json({
        success: true,
        query,
        execution: data
      });
    } catch (error) {
      return res.status(500).json({
        success: true,
        query,
        execution: { error: error.message }
      });
    }
  }

  res.status(200).json({
    success: true,
    query
  });
};

function formatFields(fields, depth) {
  const indent = '  '.repeat(depth);
  let result = '';

  fields.forEach(field => {
    if (typeof field === 'string') {
      result += `${indent}${field}\n`;
    } else if (field.alias) {
      result += `${indent}${field.alias}: ${field.name}`;
      if (field.arguments && field.arguments.length > 0) {
        result += '(' + field.arguments.map(a => `${a.name}: ${a.value}`).join(', ') + ')';
      }
      if (field.fields && field.fields.length > 0) {
        result += ' {\n';
        result += formatFields(field.fields, depth + 1);
        result += `${indent}}\n`;
      } else {
        result += '\n';
      }
    } else {
      result += `${indent}${field.name}`;
      if (field.arguments && field.arguments.length > 0) {
        result += '(' + field.arguments.map(a => `${a.name}: ${a.value}`).join(', ') + ')';
      }
      if (field.fields && field.fields.length > 0) {
        result += ' {\n';
        result += formatFields(field.fields, depth + 1);
        result += `${indent}}\n`;
      } else {
        result += '\n';
      }
    }

    // Add fragment spread
    if (field.fragmentSpread) {
      result += `${indent}...${field.fragmentSpread}\n`;
    }

    // Add inline fragment
    if (field.inlineFragment) {
      result += `${indent}... on ${field.inlineFragment.type} {\n`;
      result += formatFields(field.inlineFragment.fields, depth + 1);
      result += `${indent}}\n`;
    }
  });

  return result;
}
