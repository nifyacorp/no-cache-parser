export default function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    status: 'error',
    message: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    details: err.details || undefined
  });
} 