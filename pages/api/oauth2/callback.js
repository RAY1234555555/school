// pages/api/oauth2/callback.js
import { serialize } from 'cookie';
import { exchangeCodeForTokens, getGoogleProfile } from '../../../utils/googleOAuth'; // 假设你有这些

// --- 辅助函数：生成 8 位随机数字字符串 ---
function generate8DigitId() {
    // 生成 10,000,000 到 99,999,999 之间的数字
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export default async function handler(req, res) {
    const { code, state } = req.query;
    const savedState = req.cookies.oauthState;
    // --- 读取 Cookie 中可能已存在的 8 位学生 ID ---
    const existingStudentId = req.cookies.oauthStudentId; 

    // 验证 state
    if (!state || state !== savedState) {
        console.error('Invalid OAuth state:', { received: state, expected: savedState });
        res.setHeader('Set-Cookie', serialize('oauthState', '', { path: '/', maxAge: -1 }));
        return res.redirect('/?error=invalid_state');
    }
    res.setHeader('Set-Cookie', serialize('oauthState', '', { path: '/', maxAge: -1 })); // 清除 state

    // 验证 code
    if (!code || typeof code !== 'string') {
        console.error('No code received in callback');
        return res.redirect('/?error=no_code');
    }

    try {
        // 换取 Token
        const { id_token, access_token /*, refresh_token */ } = await exchangeCodeForTokens(code);

        // 获取 Google Profile
        const googleProfile = await getGoogleProfile(id_token, access_token);

        const googleSub = googleProfile.sub; // 仍然获取 Google Sub ID，虽然不直接存 cookie 了
        const email = googleProfile.email;
        const fullName = googleProfile.name || `${googleProfile.given_name || ''} ${googleProfile.family_name || ''}`.trim();

        if (!googleSub || !email) {
            console.error('Failed to get essential profile info from Google:', googleProfile);
            return res.redirect('/?error=profile_incomplete');
        }

        // 检查域名
        if (!email.endsWith('@kzxy.edu.kg')) { // 
            console.warn('Unauthorized domain attempt:', email);
            return res.redirect('/forbidden?reason=domain'); 
        }

        // --- 决定使用哪个 8 位学生 ID ---
        let studentIdToStore;
        if (existingStudentId && /^\d{8}$/.test(existingStudentId)) { 
            // 如果 Cookie 中已有 8 位数字 ID，继续使用它
            studentIdToStore = existingStudentId;
            console.log(`Using existing student ID from cookie: ${studentIdToStore} for ${email}`);
        } else {
            // 如果 Cookie 中没有或格式不对，生成一个新的
            studentIdToStore = generate8DigitId();
            console.log(`Generated new student ID (stored in cookie): ${studentIdToStore} for ${email}`);
        }
        // --- 结束 ID 处理 ---

        // 设置 Cookie
        const cookieOptions = { 
            path: '/', 
            httpOnly: true, 
            secure: process.env.NODE_ENV !== 'development', 
            sameSite: 'Lax', 
            maxAge: 60 * 60 * 24 * 30 // 示例：设置 30 天有效期
        };

        res.setHeader('Set-Cookie', [
            serialize('oauthUsername', email, cookieOptions),
            // *** 存储我们决定使用的 8 位 ID ***
            serialize('oauthStudentId', studentIdToStore, cookieOptions), 
            serialize('oauthFullName', fullName, cookieOptions),
            serialize('oauthTrustLevel', '3', cookieOptions), // 保持信任级别
            // 可以选择不再存储 googleSub 到 oauthUserId，除非其他地方需要
            // serialize('oauthUserId', googleSub, cookieOptions), 
        ]);

        // 重定向到门户
        console.log('OAuth callback successful, redirecting to portal for:', email);
        return res.redirect('/student-portal');

    } catch (error) {
        console.error('OAuth callback error:', error);
        return res.redirect(`/?error=callback_exception&message=${encodeURIComponent(error.message || 'Unknown error')}`);
    }
}
