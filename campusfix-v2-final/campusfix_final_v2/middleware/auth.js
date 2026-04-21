function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized. Please login.' });
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'admin') return next();
  res.status(403).json({ error: 'Admins only.' });
}
module.exports = { requireAuth, requireAdmin };
