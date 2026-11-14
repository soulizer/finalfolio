export function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function createUnauthorized(message = 'Authentication required.') {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

export function createForbidden(message = 'Forbidden.') {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

export function createNotFound(message = 'Not found.') {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}
