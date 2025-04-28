// pages/student-card.js
import Head from 'next/head'
import Script from 'next/script'
import { parse } from 'cookie'

// Helper to fetch a Google user from Directory (Keep original logic)
async function fetchGoogleUser(email) {
  // ... (fetchGoogleUser function remains exactly the same as the working version) ...
  console.log(`[fetchGoogleUser] Attempting to get refresh token for: ${email}`); 
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN, 
      grant_type:    'refresh_token'
    })
  });

  if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      console.error(`[fetchGoogleUser] Failed to refresh Google token: ${tokenRes.status}`, errorBody);
      return null; 
  }

  const { access_token } = await tokenRes.json();
  console.log(`[fetchGoogleUser] Got new access token. Fetching user data...`); 

  const userRes = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?projection=full`,
    { headers:{ Authorization:`Bearer ${access_token}` } }
  );

  if (!userRes.ok) {
      const errorBody = await userRes.text();
      console.error(`[fetchGoogleUser] Failed to fetch Google user data: ${userRes.status}`, errorBody);
      return null; 
  }
  console.log(`[fetchGoogleUser] Successfully fetched user data.`); 
  return await userRes.json();
}

// getServerSideProps (Keep original logic, adjust fallback/error text to English)
export async function getServerSideProps({ req }) {
  console.log("[getServerSideProps] Starting for student-card..."); 
  const cookies       = parse(req.headers.cookie||'');
  const oauthUsername = cookies.oauthUsername; 
  const oauthUserId   = cookies.oauthStudentId || cookies.oauthUserId; 
  const oauthFullNameFromCookie = cookies.oauthFullName; 
  const trustLevel    = parseInt(cookies.oauthTrustLevel||'0',10);

  console.log("[getServerSideProps] Cookies parsed:", cookies); 

  if (!oauthUsername) { 
    console.log("[getServerSideProps] Redirecting: No username found in cookies."); 
    return { redirect:{ destination:'/', permanent:false } }; 
  }

  const rawDom = process.env.EMAIL_DOMAIN;
  const domain = rawDom && rawDom.startsWith('@') ? rawDom : '@'+ (rawDom || 'kzxy.edu.kg'); 
  const studentEmail = oauthUsername.includes('@')
    ? oauthUsername
    : `${oauthUsername}${domain}`;

  console.log("[getServerSideProps] Attempting fetchGoogleUser for:", studentEmail); 

  const googleUser = await fetchGoogleUser(studentEmail);
  
  if (!googleUser) {
    console.log("[getServerSideProps] Redirecting: fetchGoogleUser failed (returned null)."); 
    return { redirect:{ destination:'/?error=google_fetch_failed', permanent:false } }; 
  }

  console.log("[getServerSideProps] Google user data fetched successfully."); 

  // Use English fallback text
  const fullName = googleUser.name ? `${googleUser.name.givenName || ''} ${googleUser.name.familyName || ''}`.trim() : (oauthFullNameFromCookie || 'Name Missing'); // English fallback
  const studentId = oauthUserId || googleUser.id; 

  if (!studentId) {
     console.error("[getServerSideProps] Error: Student ID is missing after checks."); 
     // Use English error message
     return { props: { error: "Student ID is missing, cannot generate student card." } }; 
  }

  console.log("[getServerSideProps] Data prepared for props:", { fullName, studentEmail, studentId }); 

  return {
    props: { 
        fullName, 
        studentEmail, 
        studentId 
    }
  };
}

// Default component export (Change display text back to English)
export default function StudentCard({
  fullName,
  studentEmail,
  studentId,
  error 
}) {
  if (error) {
      return (
          <div style={{ padding: '40px', textAlign: 'center', color: 'red', fontFamily: 'Arial, sans-serif' }}>
              {/* --- English Error Message --- */}
              <h2>Cannot Load Student Card</h2>
              <p>{error}</p>
              <a href="/student-portal" style={{color: '#007bff', textDecoration: 'underline'}}>Back to Portal</a>
              {/* --- End English Error Message --- */}
          </div>
      );
  }
  
  const sid = studentId ? String(studentId).padStart(6,'0') : 'ERRORID'; 
  const avatarUrl = studentEmail ? `https://i.pravatar.cc/150?u=${encodeURIComponent(studentEmail)}` : '/images/avatar-placeholder.png'; 

  return (
    <>
      <Head>
         {/* --- English Title --- */}
        <title>Student Card - Confucius Institute</title>
        <meta name="description" content="Confucius Institute Student ID Card" /> 
         {/* --- End English Title --- */}
      </Head>
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

      <div className="wrapper">
        <div className="card">
          <div className="school-header">
            <img 
              src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" 
              // --- English Alt Text ---
              alt="Confucius Institute Logo" 
              className="logo-in-header" 
            />
            {/* Keep Institute Name */}
            <h1>孔子学院</h1> 
            {/* Or change to: <h1>Confucius Institute</h1> if preferred */}
          </div>

          <div className="card-body">
             {/* --- English Alt Text --- */}
            <img src={avatarUrl} alt="Student Photo" className="student-photo" onError={(e) => { e.target.onerror = null; e.target.src='/images/avatar-placeholder.png'; }} />
            {/* --- Start English Text --- */}
            <h3>{fullName || 'Student Name'}</h3> {/* English fallback */}
            <p>Fall 2025</p> {/* English */}
            <p>Master of Computer Science</p> {/* English */}
            <p>{studentEmail || 'Student Email'}</p> {/* English fallback */}
            <p><strong>Student ID:</strong> {sid === 'ERRORID' ? 'Invalid ID' : sid}</p> {/* English */}
            <p className="valid-through">Valid Through: September 2028</p> {/* English */}
             {/* --- End English Text --- */}
            <div className="barcode">
              {sid !== 'ERRORID' ? (
                  <svg id="barcode" width="200" height="70"></svg>
              ) : (
                   /* --- English Error Message --- */
                  <p style={{color: 'red', fontSize: '12px', marginTop: '5px', height: '70px', display:'flex', alignItems:'center', justifyContent:'center'}}>Cannot generate barcode (ID Missing)</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Styles (Keep unchanged) */}
      <style jsx>{`
        /* ... (CSS styles remain exactly the same) ... */
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
        .logo-in-header { 
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
        h3 { 
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
