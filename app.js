import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const mode = params.get("mode") || "display";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY ||
    SUPABASE_URL.includes("YOUR_PROJECT") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
  $("errorView").classList.remove("hidden");
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (mode === "submit") setupSubmit(supabase);
  else setupDisplay(supabase);
}

function setupSubmit(supabase) {
  $("submitView").classList.remove("hidden");
  const input = $("commentInput");
  const count = $("charCount");
  const form = $("commentForm");
  const button = $("sendButton");
  input.addEventListener("input", () => count.textContent = `${input.value.length} / 200`);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = input.value.trim();
    const status = $("submitStatus");
    if (!body) { status.textContent = "コメントを入力してください。"; return; }
    if (body.length > 200) { status.textContent = "200文字以内で入力してください。"; return; }
    button.disabled = true;
    status.textContent = "送信中…";
    const { error } = await supabase.from("comments").insert({ body });
    button.disabled = false;
    if (error) {
      status.textContent = "送信できませんでした。通信状況を確認して、もう一度お試しください。";
      console.error(error);
    } else {
      input.value = "";
      count.textContent = "0 / 200";
      status.textContent = "送信しました。ありがとうございます！";
    }
  });
}

async function setupDisplay(supabase) {
  $("displayView").classList.remove("hidden");
  let comments = [];
  let lastId = null;

  function showRandom() {
    $("commentTotal").textContent = `${comments.length}件のコメント`;
    if (!comments.length) {
      $("currentComment").textContent = "コメントを待っています…";
      $("displayStatus").textContent = "スマホから投稿すると、ここに表示されます";
      lastId = null;
      return;
    }
    let choices = comments;
    if (comments.length > 1 && lastId !== null) {
      choices = comments.filter(c => c.id !== lastId);
    }
    const picked = choices[Math.floor(Math.random() * choices.length)];
    lastId = picked.id;
    $("currentComment").textContent = picked.body;
    $("displayStatus").textContent = "投稿ありがとうございます";
  }

  async function loadComments() {
    const { data, error } = await supabase
      .from("comments").select("id, body, created_at")
      .order("created_at", { ascending: false }).limit(300);
    if (error) {
      $("displayStatus").textContent = "コメントを取得できません。Supabaseの設定を確認してください。";
      console.error(error);
      return;
    }
    comments = (data || []).filter(c => typeof c.body === "string" && c.body.trim());
    showRandom();
  }

  await loadComments();
  // Supabase Realtimeで新規投稿を受信し、表示候補へ追加
  supabase.channel("public-comments")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
      const item = payload.new;
      if (item && item.id && typeof item.body === "string" && !comments.some(c => c.id === item.id)) {
        comments.unshift(item);
        comments = comments.slice(0, 300);
        $("commentTotal").textContent = `${comments.length}件のコメント`;
      }
    })
    .subscribe();

  // Realtimeの取りこぼし対策として定期的にも再取得
  setInterval(loadComments, 30000);
  // 表示コメントを10秒ごとにランダム切替
  setInterval(showRandom, 10000);
}
