import { NextApiRequest, NextApiResponse } from 'next'
import { getGoogleProfile, exchangeCodeForTokens } from '../../../utils/googleOAuth'
import { serialize } from 'cookie'

export default async function handler(req, res) {
  const { code } = req.query

  if (!code || typeof code !== 'string') {
    return res.redirect('/')
  }

  try {
    const { id_token, access_token } = await exchangeCodeForTokens(code)

    const profile = await getGoogleProfile(id_token, access_token)

    const email = profile.email || ''
    const name = profile.name || ''
    const id = profile.sub || ''

    // 检查是否是学校域名邮箱
    if (!email.endsWith('@kzxy.edu.kg')) {
      return res.redirect('/forbidden')
    }

    // 通过，设置登录状态 Cookie
    res.setHeader('Set-Cookie', [
      serialize('oauthUsername', email, { path: '/', httpOnly: true }),
      serialize('oauthUserId', id, { path: '/', httpOnly: true }),
      serialize('oauthFullName', name, { path: '/', httpOnly: true }),
      serialize('oauthTrustLevel', '3', { path: '/', httpOnly: true }),
    ])

    // 成功后直接跳转 Portal
    return res.redirect('/student-portal')

  } catch (error) {
    console.error('OAuth callback error:', error)
    return res.redirect('/')
  }
}
