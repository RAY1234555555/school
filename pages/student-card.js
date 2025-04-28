// pages/student-card.js
import Head from 'next/head'
import Script from 'next/script' // Make sure to import Script
import { parse } from 'cookie'

// Helper to fetch a Google user from Directory (保持原项目的逻辑)
async function fetchGoogleUser(email) {
  // --- IMPORTANT: This section requires valid GOOGLE_* env variables ---
  // --- including GOOGLE_REFRESH_TOKEN, CLIENT_ID, CLIENT_SECRET ---
  // --- and appropriate Admin SDK API permissions ---
  console.log(`[fetchGoogleUser] Attempting to get refresh token for: ${email}`); // Debug
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN, // This is where the error occurred
      grant_type:    'refresh_token'
    })
  });

  if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      console.error(`[fetchGoogleUser] Failed to refresh Google token: ${tokenRes.status}`, errorBody);
      // Throw an error or return null to be handled in getServerSideProps
      // throw new Error(`Failed to refresh token: ${tokenRes.status}`); 
      return null; // Returning null will trigger the redirect in getServerSideProps
  }

  const { access_token } = await tokenRes.json();
  console.log(`[fetchGoogleUser] Got new access token. Fetching user data...`); // Debug

  const userRes = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?projection=full`,
    { headers:{ Authorization:`Bearer ${access_token}` } }
  );

  if (!userRes.ok) {
      const errorBody = await userRes.text();
      console.error(`[fetchGoogleUser] Failed to fetch Google user data: ${userRes.status}`, errorBody);
      // throw new Error(`Failed to fetch user data: ${userRes.status}`);
      return null; // Returning null will trigger the redirect
  }
  console.log(`[fetchGoogleUser] Successfully fetched user data.`); // Debug
  return await userRes.json();
}

// getServerSideProps (保持原项目的逻辑)
export async function getServerSideProps({ req }) {
  console.log("[getServerSideProps] Starting for student-card..."); // Debug
  const cookies       = parse(req.headers.cookie||'');
  // --- Use the correct cookie names based on your callback.js ---
  const oauthUsername = cookies.oauthUsername; 
  const oauthUserId   = cookies.oauthStudentId || cookies.oauthUserId; // Try both common names, prioritize oauthStudentId based on your log
  const oauthFullNameFromCookie = cookies.oauthFullName; // Get full name from cookie if available
  const trustLevel    = parseInt(cookies.oauthTrustLevel||'0',10);

  console.log("[getServerSideProps] Cookies parsed:", cookies); // Debug

  // --- Adjust trust level check if needed ---
  // if (!oauthUsername || trustLevel < 3) { 
  if (!oauthUsername) { // Simplified check for testing, restore original if needed
    console.log("[getServerSideProps] Redirecting: No username found in cookies."); // Debug
    // Redirect to login or forbidden page
    return { redirect:{ destination:'/', permanent:false } }; 
  }

  // build studentEmail (保持不变)
  const rawDom = process.env.EMAIL_DOMAIN;
  const domain = rawDom && rawDom.startsWith('@') ? rawDom : '@'+ (rawDom || 'kzxy.edu.kg'); // Default to your domain
  const studentEmail = oauthUsername.includes('@')
    ? oauthUsername
    : `${oauthUsername}${domain}`;

  console.log("[getServerSideProps] Attempting fetchGoogleUser for:", studentEmail); // Debug

  // ensure user exists in Google Directory (保持不变)
  const googleUser = await fetchGoogleUser(studentEmail);
  
  // --- Handle googleUser fetch failure ---
  if (!googleUser) {
    console.log("[getServerSideProps] Redirecting: fetchGoogleUser failed (returned null)."); // Debug
    // Redirect on failure, maybe pass error message
    return { redirect:{ destination:'/?error=google_fetch_failed', permanent:false } }; 
  }

  console.log("[getServerSideProps] Google user data fetched successfully."); // Debug

  // Extract data, prioritize Google data, fallback to cookie
  const fullName = googleUser.name ? `${googleUser.name.givenName || ''} ${googleUser.name.familyName || ''}`.trim() : (oauthFullNameFromCookie || '姓名缺失');
  const studentId = oauthUserId || googleUser.id; // Use cookie ID first, fallback to Google 'sub' if needed

  // --- Ensure studentId is present ---
  if (!studentId) {
     console.error("[getServerSideProps] Error: Student ID is missing after checks."); // Debug log
     // Return props with an error message to display on the page
     return { props: { error: "学生ID丢失，无法生成学生卡。" } }; 
  }

  console.log("[getServerSideProps] Data prepared for props:", { fullName, studentEmail, studentId }); // Debug

  // Pass data to the page component
  return {
    props: { 
        fullName, 
        // personalEmail is not strictly needed by the card display based on screenshot, 
        // but pass it if you intend to use it elsewhere
        // personalEmail: googleUser.recoveryEmail || (googleUser.emails?.find(e => e.type === 'home' || e.type === 'other')?.address) || '', 
        studentEmail, // Pass the determined student email
        studentId 
    }
  };
}

// Default component export (修改 Logo 和名称)
export default function StudentCard({
  fullName,
  // personalEmail, // Removed if not used in display
  studentEmail,
  studentId,
  error // Receive error prop
}) {
  // --- Handle Error First ---
  if (error) {
      return (
          <div style={{ padding: '40px', textAlign: 'center', color: 'red', fontFamily: 'Arial, sans-serif' }}>
              <h2>无法加载学生卡</h2>
              <p>{error}</p>
              <a href="/student-portal" style={{color: '#007bff', textDecoration: 'underline'}}>返回门户</a>
          </div>
      );
  }

  // Ensure studentId is valid before processing
  const sid = studentId ? String(studentId).padStart(6,'0') : 'ERRORID'; // Use a distinct error value
  // Use placeholder if email missing
  const avatarUrl = studentEmail ? `https://i.pravatar.cc/150?u=${encodeURIComponent(studentEmail)}` : '/images/avatar-placeholder.png'; // Assumes placeholder in public/images

  return (
    <>
      <Head>
          {/* 修改页面标题 */}
        <title>学生卡 - 孔子学院</title>
        <meta name="description" content="孔子学院学生电子卡" /> 
      </Head>
      {/* Barcode Script (保持不变) */}
      <Script
        src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.JsBarcode && document.getElementById('barcode') && sid !== 'ERRORID') { 
            try {
              window.JsBarcode('#barcode', sid, {
                format: 'CODE128',
                lineColor: '#000',
                width: 2,
                height: 50,
                displayValue: true, 
                textMargin: 5 
              });
            } catch (e) { console.error("JsBarcode error:", e); }
          } else if (sid === 'ERRORID') {
              console.warn("Student ID is invalid, cannot generate barcode.");
          }
        }}
        onError={(e) => { console.error("Failed to load JsBarcode script:", e); }}
      />

      {/* Wrapper and Card Structure (保持不变) */}
      <div className="wrapper">
        <div className="card">
          {/* === School Header - Branding Changed === */}
          <div className="school-header">
            {/* 孔子学院 Logo */}
            <img 
              src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" 
              alt="孔子学院 Logo" 
              className="logo-in-header" 
            />
            {/* 孔子学院 Name */}
            <h1>孔子学院</h1>
          </div>
          {/* === End Branding Change === */}

          {/* Card Body (保持不变) */}
          <div className="card-body">
            <img src={avatarUrl} alt="学生照片" className="student-photo" onError={(e) => { e.target.onerror = null; e.target.src='/images/avatar-placeholder.png'; }} />
            <h3>{fullName || '学生姓名'}</h3>
            {/* Static info from screenshot - Keep or make dynamic if needed */}
            <p>Fall 2025</p> 
            <p>Master of Computer Science</p> 
            {/* --- End Static Info --- */}
            <p>{studentEmail || '学生邮箱'}</p>
            <p><strong>学生ID:</strong> {sid === 'ERRORID' ? '无效ID' : sid}</p>
            {/* Static info from screenshot */}
            <p className="valid-through">有效期至: September 2028</p> 
            {/* --- End Static Info --- */}
            <div className="barcode">
              {/* Conditional rendering for barcode area */}
              {sid !== 'ERRORID' ? (
                  <svg id="barcode" width="200" height="70"></svg>
              ) : (
                  <p style={{color: 'red', fontSize: '12px', marginTop: '5px', height: '70px', display:'flex', alignItems:'center', justifyContent:'center'}}>无法生成条形码 (ID丢失)</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Styles (保持不变, 包含 logo-in-header 样式) */}
      <style jsx>{`
        /* Styles copied from the previous correct version */
        .wrapper {
          min-height:100vh; display:flex; justify-content:center; align-items:center;
          background:url('https://png.pngtree.com/thumb_back/fw800/background/20231028/pngtree-stunning-isolated-wood-table-top-texture-with-exquisite-texture-image_13705698.png') center/cover no-repeat;
          padding:20px; font-family: Arial, sans-serif;
        }
        .card {
          width: 350px; max-width: 90%; background:linear-gradient(145deg,#f8f9fa,#ffffff);
          border:1px solid #dee2e6; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.1); overflow:hidden;
        }
        .school-header {
          display:flex; align-items:center; gap:10px; background: #0056b3; padding:12px 18px;
        }
        .logo-in-header { /* Style for the Confucius Institute logo */
           width: 32px; height: 32px; object-fit: contain; border-radius: 4px;
        }
        .school-header h1 {
          margin:0; font-size:18px; color:#fff; font-weight: 600;
        }
        .card-body {
          background:#fff; padding:25px; text-align:center;
        }
        .student-photo {
          width:90px; height:90px; object-fit:cover; border:4px solid #e9ecef;
          border-radius:50%; box-shadow:0 3px 8px rgba(0,0,0,0.15); margin-bottom:15px;
        }
        h3 { /* Student Name */
          margin:10px 0 5px 0; font-size:18px; color:#212529; font-weight: 600;
        }
        p {
          margin:4px 0; font-size:14px; color:#495057; line-height: 1.5;
        }
        p strong { font-weight: 600; color: #343a40; }
        .valid-through {
          margin-top:15px; font-weight:bold; font-size: 13px; color:#555;
        }
        .barcode {
          margin-top:18px; display: flex; flex-direction: column; align-items: center;
        }
        .barcode :global(text) { font-size: 14px !important; font-family: monospace !important; }
      `}</style>
    </>
  )
}
