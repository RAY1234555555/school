import cookie from 'cookie'

export default function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '')
  res.status(200).json({
    name: cookies.oauthUsername || '',
    email: cookies.oauthEmail || '',
  })
}
