import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const mode = params.get("mode") || "display";
if (mode === "admin") $("adminView").classList.remove("hidden");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY ||
    SUPABASE_URL.includes("YOUR_PROJECT") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
  $("errorView").classList.remove("hidden");
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 if (mode === "submit") {
  setupSubmit(supabase);
} else if (mode === "admin") {
  setupAdmin(supabase);
} else {
  setupDisplay(supabase);
}
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
function setupAdmin(supabase) {
  $("adminView").classList.remove("hidden");

  const form = $("adminLoginForm");
  const email = $("adminEmail");
  const password = $("adminPassword");
  const status = $("adminStatus");
  const loginButton = $("adminLoginButton");
  const panel = $("adminPanel");
  const presentationForm = $("presentationForm");
  const presentationTitle = $("presentationTitle");
  const presentationStatus = $("presentationStatus");
  const currentPresentation = $("currentPresentation");
  const presentationList = $("presentationList");

  async function loadPresentations() {
    currentPresentation.textContent = "読み込み中…";
    presentationList.replaceChildren();

    const { data, error } = await supabase
      .from("presentations")
      .select("id, title, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      currentPresentation.textContent =
        "発表を読み込めませんでした。";
      console.error(error);
      return;
    }

    const active = data.find(
      (item) => item.status === "active"
    );

    currentPresentation.textContent = active
      ? active.title
      : "開催中の発表はありません。";

    const archived = data.filter(
      (item) => item.status === "archived"
    );

    if (archived.length === 0) {
      const li = document.createElement("li");
      li.textContent = "過去の発表はまだありません。";
      presentationList.appendChild(li);
      return;
    }

    archived.forEach((item) => {
      const li = document.createElement("li");

      li.textContent =
        item.title + "（" +
        new Date(item.created_at).toLocaleDateString("ja-JP") +
        "）";

      presentationList.appendChild(li);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    loginButton.disabled = true;
    status.textContent = "ログイン中…";

    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value
      });

    loginButton.disabled = false;

    if (error) {
      status.textContent =
        "ログインできませんでした。メールアドレスとパスワードを確認してください。";
      console.error(error);
      return;
    }

    const { data: admin, error: adminError } =
      await supabase.rpc("is_admin");

    if (adminError || admin !== true) {
      await supabase.auth.signOut();
      status.textContent =
        "このアカウントには管理者権限がありません。";
      console.error(adminError);
      return;
    }

    status.textContent = "ログイン成功！";
    panel.classList.remove("hidden");
    loginButton.classList.add("hidden");

    await loadPresentations();
  });

  presentationForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const title = presentationTitle.value.trim();

      if (!title) {
        presentationStatus.textContent =
          "発表名を入力してください。";
        return;
      }

      const createButton =
        $("createPresentationButton");

      createButton.disabled = true;
      presentationStatus.textContent =
        "発表を作成中…";

      try {
        const { error } = await supabase.rpc(
          "create_presentation",
          { p_title: title }
        );

        if (error) {
          console.error(error);
          presentationStatus.textContent =
            "作成できませんでした。エラーを確認してください。";
          return;
        }

        presentationStatus.textContent =
          "新しい発表を作成しました！";

        presentationTitle.value = "";
        await loadPresentations();
      } finally {
        createButton.disabled = false;
      }
    }
  );

  $("adminLogoutButton").addEventListener(
    "click",
    async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        status.textContent =
          "ログアウトできませんでした。";
        console.error(error);
        return;
      }

      panel.classList.add("hidden");
      loginButton.classList.remove("hidden");
      password.value = "";
      status.textContent = "ログアウトしました。";
      presentationStatus.textContent = "";
    }
  );
}
