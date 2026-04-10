// === REPLACE THESE WITH YOUR REAL KEYS ===
const SUPABASE_URL = 'https://ydutxsguqrvgtqtjzbjv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_LbnCj2nM89a_JQ2eavJJ9A_G6dof_ks';

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentReceiver = null;   // the person you are chatting with

// ====================== AUTH ======================
async function signUp() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) alert(error.message);
  else alert("Iyandikishwa ryagenze neza! Komeza kwinjira.");
}

async function logIn() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
  else {
    currentUser = data.user;
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'flex';
    loadUsers();
    loadConversations();
  }
}

function logout() {
  supabase.auth.signOut();
  location.reload();
}

// ====================== USERS LIST ======================
async function loadUsers() {
  const { data } = await supabase.from('profiles').select('id, username, full_name').limit(50);
  const list = document.getElementById('users-list');
  list.innerHTML = '';
  data.forEach(user => {
    if (user.id === currentUser.id) return;
    const div = document.createElement('a');
    div.className = 'list-group-item list-group-item-action';
    div.textContent = user.username || user.full_name || user.id.slice(0,8);
    div.onclick = () => startChatWith(user);
    list.appendChild(div);
  });
}

function searchUsers() {
  // simple client filter - works fine for small community
  const term = document.getElementById('search').value.toLowerCase();
  // re-run loadUsers and filter (or improve with .ilike later)
  loadUsers(); // for now we reload
}

// ====================== START CHAT ======================
async function startChatWith(user) {
  currentReceiver = user;
  document.getElementById('chat-with').textContent = `Kuganira na ${user.username || user.full_name}`;
  loadMessages();
}

// ====================== MESSAGES ======================
async function loadMessages() {
  if (!currentReceiver) return;
  const { data } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentReceiver.id}),and(sender_id.eq.${currentReceiver.id},receiver_id.eq.${currentUser.id})`)
    .order('created_at', { ascending: true });

  const window = document.getElementById('chat-window');
  window.innerHTML = '';
  data.forEach(msg => {
    const div = document.createElement('div');
    div.className = `message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}`;
    div.textContent = msg.message;
    window.appendChild(div);
  });
  window.scrollTop = window.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  if (!message || !currentReceiver) return;

  await supabase.from('messages').insert({
    sender_id: currentUser.id,
    receiver_id: currentReceiver.id,
    message: message
  });
  input.value = '';
  loadMessages(); // refresh
}

// ====================== REALTIME ======================
function subscribeToRealtime() {
  supabase
    .channel('messages')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        // only refresh if it's part of current chat
        if (currentReceiver &&
            (payload.new.sender_id === currentUser.id || payload.new.receiver_id === currentUser.id) &&
            (payload.new.sender_id === currentReceiver.id || payload.new.receiver_id === currentReceiver.id)) {
          loadMessages();
        }
        // you can also refresh conversation list here later
      }
    )
    .subscribe();
}

// Load conversations list (simple recent contacts) - you can expand this
async function loadConversations() {
  // For now we use the full users list above. Later you can show "recent chats"
}

// Start everything
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    currentUser = session.user;
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'flex';
    loadUsers();
    subscribeToRealtime();
  }
});
