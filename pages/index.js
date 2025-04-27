export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '100px' }}>
      <img 
        src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" 
        alt="Confucius Institute Logo"
        style={{ width: '120px', height: 'auto', marginBottom: '20px' }}
      />
      <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>
        Welcome to Confucius Institute - 孔子学院
      </h1>
      <p>Please authenticate via your school email to continue:</p>
      <a href="/api/oauth2/initiate">
        <button style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: '5px' }}>
          Sign in with Google
        </button>
      </a>
    </div>
  );
}
