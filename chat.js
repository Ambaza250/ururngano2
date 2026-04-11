// ================== YOUR KEYS - REPLACE THESE ==================
const SUPABASE_URL = 'https://ydutxsguqrvgtqtjzbjv.supabase.co';   // ← Change this
const SUPABASE_ANON_KEY = 'sb_publishable_LbnCj2nM89a_JQ2eavJJ9A_G6dof_ks';            // ← Paste your Publishable key here

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const status = document.getElementById('status');

// ====================== SIGN UP ======================
async function signUp() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  status.textContent = "Tegereza...";
  
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
  });

  if (error) {
    status.textContent = "Ikosa: " + error.message;
    console.error(error);
  } else {
    status.innerHTML = "✅ Iyandikishwa ryagenze neza!<br>Email yawe yoherejwe. Kanda link muri email kugira ngo ukomeze.";
    console.log("User:", data.user);
  }
}

// ====================== LOGIN ======================
async function logIn() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  status.textContent = "Tegereza...";
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    status.textContent = "Ikosa: " + error.message;
    console.error(error);
  } else {
    status.textContent = "✅ Kwinjira byagenze neza! Murakaza neza " + email;
    console.log("Logged in user:", data.user);
    
    // You can redirect to main chat later
    setTimeout(() => {
      alert("Kwinjira byagenze neza! (Next step: add chat window here)");
    }, 1000);
  }
}

// Auto check if already logged in
supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    status.textContent = "✅ Wari usanzwe winjiye";
  }
});
