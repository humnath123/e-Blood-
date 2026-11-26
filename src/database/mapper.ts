// Mapping from UPPER_SNAKE_CASE to camelCase
// Used to convert Oracle column names (which are typically UPPER_SNAKE_CASE)
// to camelCase JSON keys as required by the API specification.

const snakeToCamel = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/_([a-z])/g, (_, char) => char.toUpperCase());
};

const isPlainObject = (value: any): boolean => {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export const toCamelCase = (obj: Record<string, any>): Record<string, any> => {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(toCamelCase) as unknown as Record<string, any>;
  }

  // Only recurse into plain objects. Return primitives, Dates, CLOB Lob
  // instances, Buffers, and other class instances untouched (they may hold
  // circular references that would blow the stack).
  if (!isPlainObject(obj)) {
    return obj;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    result[camelKey] = toCamelCase(value);
  }
  return result;
};

// Special handler for boolean values returned as NUMBER(1) from Oracle
// Oracle returns 0/1 for booleans, we convert to true/false in JSON
export const mapBooleanFields = <T>(obj: T): T => {
  if (obj === null || obj === undefined) return obj;

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "active" || lowerKey === "is_active" || lowerKey === "status") {
      // Oracle NUMBER(1) where 0 = false, 1 = true
      if (value === 0) {
        result[key] = false;
      } else if (value === 1) {
        result[key] = true;
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result as T;
};

// Map result set rows - apply camelCase conversion and boolean mapping
export const mapRowResults = <T>(
  rows: any[],
  booleanFields: string[] = []
): T[] => {
  if (!rows || rows.length === 0) return [];

  return rows.map((row) => {
    const camel = toCamelCase(row);
    // Apply boolean mapping for specific fields if needed
    if (booleanFields.length > 0) {
      return mapBooleanFields(camel) as unknown as T;
    }
    return camel as unknown as T;
  });
};