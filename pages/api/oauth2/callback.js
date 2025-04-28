// pages/api/oauth2/callback.js
import { serialize } from 'cookie';
// 确保你已经正确导入了这两个辅助函数，路径可能需要调整
import { exchangeCodeForTokens, getGoogleProfile } from '../../../utils/googleOAuth'; 

// --- 辅助函数：生成 8 位随机数字字符串 ---
function generate8DigitId() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export default async function handler(req, res) {
    console.log('--- Callback Start ---'); // 开始日志
    console.log('[Callback] Request Cookies:', JSON.stringify(req.cookies || {})); // 打印所有请求 Cookie
    console.log('[Callback] Request Query:', JSON.stringify(req.query || {}));   // 打印查询参数 (code, state)

    const { code, state } = req.query;
    const savedState = req.cookies.oauthState; // 从请求的 cookie 中读取 state
    const existingStudentId = req.cookies.oauthStudentId; // 读取可能存在的学生 ID

    // 1. 验证 state 防止 CSRF
    if (!state || typeof state !== 'string' || !savedState || state !== savedState) {
        console.error('[Callback] STATE MISMATCH OR MISSING!', { received: state, expected: savedState });
        // 清除可能无效的 state cookie
        res.setHeader('Set-Cookie', serialize('oauthState', '', { path: '/', maxAge: -1 }));
        console.log('--- Callback End (Redirecting due to invalid state) ---');
        return res.redirect('/?error=invalid_state'); // 重定向到首页并带错误提示
    }
    console.log('[Callback] State validated successfully.');
    // State 验证成功后，清除 state cookie
    res.setHeader('Set-Cookie', serialize('oauthState', '', { path: '/', maxAge: -1 }));

    // 2. 验证 code 是否存在
    if (!code || typeof code !== 'string') {
        console.error('[Callback] NO CODE received in query!');
        console.log('--- Callback End (Redirecting due to no code) ---');
        return res.redirect('/?error=no_code');
    }
    console.log('[Callback] Code received (length):', code.length); // 不直接打印 code，打印长度

    try {
        // 3. 用 code 换取 tokens
        console.log('[Callback] Attempting to exchange code for tokens...');
        const { id_token, access_token /*, refresh_token */ } = await exchangeCodeForTokens(code);
        // 检查 token 是否获取成功
        if (!id_token || !access_token) {
            console.error('[Callback] Failed to retrieve tokens from exchange.');
            console.log('--- Callback End (Redirecting due to token exchange failure) ---');
            return res.redirect('/?error=token_exchange_failed');
        }
        console.log('[Callback] Tokens received successfully.');

        // 4. 用 tokens 获取 Google 用户 profile
        console.log('[Callback] Attempting to get Google profile...');
        const googleProfile = await getGoogleProfile(id_token, access_好的token);
        console.log('[Callback] Google Profile received:', JSON.stringify(googleProfile, null, 2));，这是包含了详细日志记录的完整 `/api/oauth2/callback.js` 代码。请将此代码** // 打印完整的 Profile 内容

        // 5. 验证 Profile 中的关键信息
        const googleSub = google完整替换**你项目中对应的文件内容。

```javascript
// pages/api/oauth2/callback.jsProfile.sub;
        const email = googleProfile.email;
        // 尝试多种方式获取姓名

import { serialize } from 'cookie';
// --- 确保你已经正确导入或实现了这两个函数 ---
//        const fullName = googleProfile.name || 
                         `${googleProfile.given_name || ''} ${google import { exchangeCodeForTokens, getGoogleProfile } from '../../../utils/googleOAuth'; 

// --- Placeholder functionsProfile.family_name || ''}`.trim() ||
                         email.split('@')[0]; // Fallback to if you haven't implemented them ---
// --- Replace these with your actual implementation ---
async function exchangeCodeForTokens part of email

        if (!googleSub || !email) {
            console.error('[Callback] INCOMPLETE PROFILE from Google! Missing sub or email.');
            console.log('--- Callback End (Redirecting due to incomplete profile) ---');
            return res.redirect('/?error=profile_incomplete');
        }
        console.log(code) {
    console.log("[exchangeCodeForTokens] Exchanging code:", code);
    // ---('[Callback] Profile contains essential info:', { googleSub: googleSub, email: email });

        // 6. This is where you call Google's token endpoint ---
    // Example using fetch:
    const tokenUrl = ' 检查邮箱域名
        const requiredDomain = '@kzxy.edu.kg'; // 将你的域名放在这里
        ifhttps://oauth2.googleapis.com/token';
    const response = await fetch(tokenUrl, {
        method: (!email.endsWith(requiredDomain)) {
            console.warn('[Callback] UNAUTHORIZED DOMAIN:', email 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded');
            console.log('--- Callback End (Redirecting to forbidden page) ---');
            return res. },
        body: new URLSearchParams({
            code: code,
            client_id: process.envredirect(`/forbidden?reason=domain&attempted=${encodeURIComponent(email)}`); // 跳转到禁止访问页
        }
        console.log('[Callback] Domain validated successfully.');

        // 7. 决定学生 ID (优先 Cookie.GOOGLE_CLIENT_ID,       // Ensure these are set
            client_secret: process.env.GOOGLE_CLIENT_SECRET, // Ensure these are set
            redirect_uri: process.env.OAUTH_REDIRECT_URI, // Ensure this is set and matches GCP
            grant_type: 'authorization_code'
        })
     中的 8 位数字)
        let studentIdToStore;
        const studentIdRegex = /^\d{8});
    if (!response.ok) {
        const errorBody = await response.text();
        console}$/; // 正则表达式检查是否为 8 位数字
        if (existingStudentId && studentIdRegex.test(existingStudentId)) {
            studentIdToStore = existingStudentId;
            console.log(`[.error(`[exchangeCodeForTokens] Error response from Google: ${response.status}`, errorBody);
        throw new Error(`Failed to exchange code: ${response.status} ${errorBody}`);
    }
    const tokens = await response.json();
    console.log("[exchangeCodeForTokens] Tokens received successfully.");
    // Ensure expectedCallback] Using existing 8-digit student ID from cookie: ${studentIdToStore}`);
        } else {
            studentIdToStore = generate8DigitId();
            console.log(`[Callback] Generated new 8-digit student ID (to be stored in cookie): ${studentIdToStore}`);
        }

        // 8. 设置 Cookies tokens are present
    if (!tokens.id_token || !tokens.access_token) {
        console.error("[exchangeCodeForTokens] Missing id_token or access_token in response:", tokens);
        throw new Error("
        const cookieOptions = {
            path: '/',
            httpOnly: true, // 防止客户端 JS 读取
            secure: process.env.NODE_ENV !== 'development', // 生产环境强制 HTTPS
            sameIncomplete token response from Google");
    }
    return tokens; // Should contain id_token, access_token, etc.
}

async function getGoogleProfile(id_token, access_token) {
    console.log("[getGoogleProfile] Verifying ID token and fetching profile...");
    // --- Option 1: Verify ID TokenSite: 'Lax', // 增强安全性
            maxAge: 60 * 60 * 24 * 30 // 30 天有效期 (可调整)
        };
        console.log('[Callback] Setting (Recommended) ---
    // Use a library like 'google-auth-library' to verify the id_token
     cookies with studentId:', studentIdToStore);
        res.setHeader('Set-Cookie', [
            serialize('oauthUsername', email, cookieOptions),
            serialize('oauthStudentId', studentIdToStore, cookieOptions), // // This is more secure as it validates the token's signature and claims (audience, issuer)
    // Example (requires installing google-auth-library):
    /*
    try {
        const { OAuth2Client }存储 8 位 ID
            serialize('oauthFullName', fullName || '', cookieOptions), // 确保 fullName 不是 undefined = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: id_
            serialize('oauthTrustLevel', '3', cookieOptions), // 设置信任级别
            // 可以移除 oauthUserIdtoken,
            audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app 如果不再需要 Google sub ID
            // serialize('oauthUserId', googleSub, cookieOptions), 
        ]);

         that accesses the backend
        });
        const payload = ticket.getPayload();
        console.log("[getGoogleProfile]// 9. 重定向到学生门户
        console.log('--- Callback End (Redirecting to portal successfully ID Token verified. Payload:", payload);
        // Ensure necessary fields are present
         if (!payload.sub || !payload) ---');
        return res.redirect('/student-portal');

    } catch (error) {
        .email) {
             console.error("[getGoogleProfile] Missing sub or email in ID token payload:", payload);
            // 捕获所有可能的异常 (网络错误, Token 验证错误, Profile 获取错误等)
        console.throw new Error("Incomplete profile info in ID token");
         }
        return payload; // Contains sub, email,error('!!! OAUTH CALLBACK EXCEPTION !!!:', error.message || error);
        // 可以打印更详细的错误堆 name, given_name, family_name etc.
    } catch (error) {
        console.error("[get栈
        // console.error(error.stack); 
        console.log('--- Callback End (RedirectingGoogleProfile] Error verifying ID token:", error);
        throw new Error(`ID token verification failed: ${error.message}`);
    }
    */

    // --- Option 2: Use Access Token to call userinfo endpoint (Sim due to exception) ---');
        // 将错误信息（简化版）传给前端
        return res.redirect(`/?error=callback_exception&message=${encodeURIComponent(error.message || 'Unknown error')}`);
    }
}
```pler, less validation) ---
    // Less secure because it doesn't automatically verify the audience (aud claim) like

**关键点和如何使用：**

1.  **替换文件**: 用这段代码完全替换你项目中的 ID token verification does.
    try {
        const response = await fetch('https://www.googleapis.com/ `pages/api/oauth2/callback.js` 文件。
2.  **检查导入**: 确保顶oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}`部的 `import { exchangeCodeForTokens, getGoogleProfile } from '../../../utils/googleOAuth';` 路径是正确的，指向 }
        });
        if (!response.ok) {
             const errorBody = await response.text();
             console.error(`[getGoogleProfile] Error fetching userinfo: ${response.status}`, errorBody);
             throw new Error(`你实际存放这两个辅助函数的文件。
3.  **检查域名**: 确保第 6 步中的Failed to fetch userinfo: ${response.status}`);
        }
        const profile = await response.json();
        console.log("[getGoogleProfile] Userinfo fetched:", profile);
         // Ensure necessary fields are present
         if (!profile `const requiredDomain = '@kzxy.edu.kg';` 包含你正确的学校邮箱域名。
4.  **部署**: 将修改后的代码提交并部署到 Vercel。
5.  **测试和.sub || !profile.email) {
             console.error("[getGoogleProfile] Missing sub or email in查看日志**:
    *   清除你浏览器中与你的应用相关的 Cookie（或者使用浏览器的隐身模式）。
 userinfo response:", profile);
            throw new Error("Incomplete profile info from userinfo endpoint");
         }    *   执行一次完整的登录流程。
    *   如果再次被重定向回登录页，**立刻去
        return profile; // Contains sub, email, name, given_name, family_name etc.
    } catch Vercel 控制台查看 `/api/oauth2/callback` 的运行时日志**。
    *   日志 (error) {
         console.error("[getGoogleProfile] Error fetching userinfo:", error);
         throw new Error(`Userinfo fetch failed: ${error.message}`);
    }
}
// --- End Placeholder Functions ---


//中会包含 `[Callback] ...` 前缀的详细输出，告诉你执行到了哪一步，以及可能在哪里 --- 辅助函数：生成 8 位随机数字字符串 ---
function generate8DigitId() {
    return出了问题（例如 "STATE MISMATCH", "NO CODE", "INCOMPLETE PROFILE", "UNAUTHORIZED DOMAIN", "!!! Math.floor(10000000 + Math.random() * 90000000).toString();
}

export default async function handler(req, res) {
    console. OAUTH CALLBACK EXCEPTION !!!" 等）。

根据日志输出，我们就能更精确地定位问题所在了。
