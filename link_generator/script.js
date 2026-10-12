const $ = (id) => document.getElementById(id);
    const baseUrlModeEl = $("baseUrlMode");
    const baseUrlSingleEl = $("baseUrlSingle");
    const baseUrlRows = $("baseUrlRows");
    const tokenEl = $("token");
    const tokensListEl = $("tokensList");
    const tokenConfigContainer = $("tokenConfigContainer");
    const openInNewTabEl = $("openInNewTab");
    const profileTitleEl = $("profileTitle");
    const profileDescEl = $("profileDesc");
    const profileDescCount = $("profileDescCount");
    const profileFolderEl = $("profileFolder");
    const profilesCountEl = $("profilesCount");
    const profilesList = $("profilesList");
    const foldersList = $("foldersList");
    const profilesPanel = $("profilesPanel");
    const profileEditor = $("profileEditor");

    const themeToggle = $("themeToggle");
    const themeLabel = $("themeLabel");
    const errorBox = $("errorBox");

    const PROFILES_KEY = "lgProfilesV3";
    const FOLDERS_KEY = "lgFoldersV1";
    const THEME_KEY = "lgTheme";

    let profiles = [];
    let folders = ["General"];
    let currentProfileId = null;

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.classList.remove("hidden");
      setTimeout(() => errorBox.classList.add("hidden"), 3500);
    }

    function uuid() {
      return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    function getUsageUrl(profile, profilesToShare = [profile]) {
      const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(profilesToShare)))));
      const url = new URL("pages/usage.html", location.href);
      url.hash = `profiles=${encoded}&selected=${encodeURIComponent(profile.id)}`;
      return url.href;
    }

    function initTheme() {
      const t = localStorage.getItem(THEME_KEY) || "dark";
      document.documentElement.setAttribute("data-theme", t);
      themeLabel.textContent = t === "dark" ? "Dark" : "Light";
    }
    themeToggle.addEventListener("click", () => {
      const t = document.documentElement.getAttribute("data-theme") || "dark";
      const nt = t === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nt);
      localStorage.setItem(THEME_KEY, nt);
      themeLabel.textContent = nt === "dark" ? "Dark" : "Light";
    });

    function loadProfiles() {
      try {
        const s = localStorage.getItem(PROFILES_KEY);
        const storedProfiles = s ? JSON.parse(s) : [];
        profiles = Array.isArray(storedProfiles) ? storedProfiles : [];
      } catch (e) {
        profiles = [];
        showError("Saved profiles could not be read.");
      }
      try {
        const storedFolders = JSON.parse(localStorage.getItem(FOLDERS_KEY) || '["General"]');
        folders = Array.isArray(storedFolders) ? storedFolders.filter((folder) => typeof folder === "string" && folder.trim()) : ["General"];
      } catch (e) {
        folders = ["General"];
        showError("Saved folders could not be read. Using the General folder.");
      }
      folders = [...new Set(["General", ...folders.map((folder) => folder.trim())])];
      profiles.forEach((profile) => {
        if (!folders.includes(profile.folder)) profile.folder = "General";
      });
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      renderProfiles();
    }

    function saveProfiles() {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      renderProfiles();
    }

    function saveFolders() {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      renderProfiles();
    }

    function renderProfiles() {
      profilesList.replaceChildren();
      folders.forEach((folder) => {
        const folderProfiles = profiles.filter((profile) => (profile.folder || "General") === folder);
        if (folder !== "General" && folderProfiles.length) {
          const heading = document.createElement("div");
          heading.className = "profile-folder-title";
          heading.textContent = `${folder} (${folderProfiles.length})`;
          profilesList.appendChild(heading);
        }
        folderProfiles.forEach((p) => {
          const item = document.createElement("div");
          item.className = "profile-item";
          const info = document.createElement("div");
          const title = document.createElement("div");
          title.className = "profile-item-title";
          title.textContent = p.title || "Untitled";
          info.appendChild(title);
          if (p.description) {
            const description = document.createElement("div");
            description.className = "profile-item-description";
            description.textContent = p.description;
            info.appendChild(description);
          }
          const actions = document.createElement("div");
          actions.className = "actions";
          const edit = document.createElement("button");
          edit.type = "button";
          edit.className = "btn-secondary";
          edit.textContent = "Edit";
          edit.addEventListener("click", () => {
            loadDraft(p);
            openProfileEditor("Edit Profile");
          });
          const use = document.createElement("button");
          use.type = "button";
          use.textContent = "Use";
          use.addEventListener("click", () => {
            location.href = getUsageUrl(p, profiles);
          });
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "btn-danger";
          remove.textContent = "Delete";
          remove.addEventListener("click", () => {
            profiles = profiles.filter((profile) => profile.id !== p.id);
            if (currentProfileId === p.id) currentProfileId = null;
            saveProfiles();
            showError("Profile deleted");
          });
          actions.append(use, edit, remove);
          item.append(info, actions);
          profilesList.appendChild(item);
        });
      });
      if (profiles.length === 0) {
        const empty = document.createElement("div");
        empty.className = "helper-text";
        empty.textContent = "No profiles yet. Select New Profile to create one.";
        profilesList.appendChild(empty);
      }
      profilesCountEl.textContent = profiles.length + (profiles.length === 1 ? " profile" : " profiles");
      profileFolderEl.replaceChildren(...folders.map((folder) =>
        new Option(folder === "General" ? "Default folder" : folder, folder)
      ));
      const selectedProfile = profiles.find((profile) => profile.id === currentProfileId);
      $("usageNav").href = profiles.length
        ? getUsageUrl(selectedProfile || profiles[0], profiles)
        : "pages/usage.html";
      renderFolderSettings();
    }

    function renderFolderSettings() {
      foldersList.replaceChildren();
      folders.filter((folder) => folder !== "General").forEach((folder) => {
        const row = document.createElement("div");
        row.className = "folder-item";
        const name = document.createElement("input");
        name.type = "text";
        name.value = folder;
        name.setAttribute("aria-label", `Folder name: ${folder}`);
        const rename = document.createElement("button");
        rename.type = "button";
        rename.className = "btn-secondary";
        rename.textContent = "Rename";
        rename.addEventListener("click", () => {
          const updatedName = name.value.trim();
          if (!updatedName) {
            showError("Folder name is required.");
            return;
          }
          if (folders.some((existing) => existing.toLowerCase() === updatedName.toLowerCase() && existing !== folder)) {
            showError("A folder with that name already exists.");
            return;
          }
          folders = folders.map((existing) => existing === folder ? updatedName : existing);
          profiles.forEach((profile) => {
            if (profile.folder === folder) profile.folder = updatedName;
          });
          if (profileFolderEl.value === folder) profileFolderEl.value = updatedName;
          saveFolders();
          showError("Folder renamed.");
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn-danger";
        remove.textContent = "Delete";
        remove.addEventListener("click", () => {
          profiles.forEach((profile) => {
            if (profile.folder === folder) profile.folder = "General";
          });
          folders = folders.filter((existing) => existing !== folder);
          if (!folders.includes(profileFolderEl.value)) profileFolderEl.value = "General";
          saveFolders();
          showError("Folder deleted. Its profiles were moved to General.");
        });
        row.append(name, rename, remove);
        foldersList.appendChild(row);
      });
      if (folders.length === 1) {
        const empty = document.createElement("div");
        empty.className = "helper-text";
        empty.textContent = "Profiles use the default folder unless you create another folder.";
        foldersList.appendChild(empty);
      }
    }

    function openProfileEditor(title) {
      $("editorHeading").textContent = title;
      profilesPanel.classList.add("hidden");
      profileEditor.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function getBaseUrls() {
      if (baseUrlModeEl.value === "single") {
        return baseUrlSingleEl.value.trim() ? [baseUrlSingleEl.value.trim()] : [];
      }
      return [...baseUrlRows.querySelectorAll("input")].map((input) => input.value.trim()).filter(Boolean);
    }

    function renderBaseUrlRows(urls) {
      baseUrlRows.replaceChildren();
      (urls.length ? urls : [""]).forEach((url, index) => {
        const row = document.createElement("div");
        row.className = "base-url-row";
        const input = document.createElement("input");
        input.type = "text";
        input.value = url;
        input.placeholder = `Base URL ${index + 1}`;
        input.autocomplete = "off";
        input.spellcheck = false;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn-danger";
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Remove base URL ${index + 1}`);
        remove.addEventListener("click", () => {
          const remaining = [...baseUrlRows.querySelectorAll("input")]
            .filter((field) => field !== input)
            .map((field) => field.value);
          renderBaseUrlRows(remaining);
        });
        row.append(input, remove);
        baseUrlRows.appendChild(row);
      });
    }

    function setBaseUrlMode(mode) {
      baseUrlModeEl.value = mode;
      $("singleBaseUrlField").classList.toggle("hidden", mode !== "single");
      $("multiBaseUrlsField").classList.toggle("hidden", mode !== "multi");
    }

    baseUrlModeEl.addEventListener("change", () => {
      if (baseUrlModeEl.value === "multi") {
        renderBaseUrlRows([baseUrlSingleEl.value]);
        setBaseUrlMode("multi");
        return;
      }
      const urls = [...baseUrlRows.querySelectorAll("input")]
        .map((input) => input.value.trim())
        .filter(Boolean);
      if (urls.length > 1) {
        baseUrlModeEl.value = "multi";
        setBaseUrlMode("multi");
        showError("Single-link mode supports one URL. Remove extra URLs before switching.");
        return;
      }
      baseUrlSingleEl.value = urls[0] || baseUrlSingleEl.value;
      setBaseUrlMode("single");
    });
    $("addBaseUrlBtn").addEventListener("click", () => {
      renderBaseUrlRows([...baseUrlRows.querySelectorAll("input")].map((input) => input.value).concat(""));
      baseUrlRows.lastElementChild?.querySelector("input")?.focus();
    });

    function getCurrentDraft() {
      const tokens = Array.isArray(window.__tokens) ? window.__tokens.filter(Boolean) : [];
      const cfg = window.__tokenConfig || {};
      const description = profileDescEl.value.trim().slice(0, 255);
      return {
        id: currentProfileId || uuid(),
        title: profileTitleEl.value.trim(),
        description,
        folder: profileFolderEl.value || "General",
        baseUrls: getBaseUrls(),
        baseUrl: getBaseUrls()[0] || "",
        baseUrlMode: baseUrlModeEl.value,
        tokens,
        tokenConfig: JSON.parse(JSON.stringify(cfg)),
        openInNewTab: openInNewTabEl.checked,
        updatedAt: new Date().toISOString(),
      };
    }

    function loadDraft(p) {
      currentProfileId = p.id;
      profileTitleEl.value = p.title || "";
      profileDescEl.value = (p.description || "").slice(0, 255);
      profileDescCount.textContent = profileDescEl.value.length;
      profileFolderEl.value = folders.includes(p.folder) ? p.folder : "General";
      const baseUrls = Array.isArray(p.baseUrls) && p.baseUrls.length
        ? p.baseUrls
        : (p.baseUrl ? [p.baseUrl] : []);
      const mode = p.baseUrlMode || (baseUrls.length > 1 ? "multi" : "single");
      baseUrlSingleEl.value = baseUrls[0] || "";
      renderBaseUrlRows(baseUrls);
      setBaseUrlMode(mode === "multi" ? "multi" : "single");
      window.__tokens = Array.isArray(p.tokens) ? p.tokens.slice() : [];
      window.__tokenConfig = p.tokenConfig ? JSON.parse(JSON.stringify(p.tokenConfig)) : {};
      openInNewTabEl.checked = p.openInNewTab !== false;
      renderTokens();
      renderTokenConfig();
    }

    $("newProfileBtn").addEventListener("click", () => {
      currentProfileId = null;
      profileTitleEl.value = "";
      profileDescEl.value = "";
      profileDescCount.textContent = "0";
      profileFolderEl.value = "General";
      baseUrlSingleEl.value = "";
      renderBaseUrlRows([""]);
      setBaseUrlMode("single");
      window.__tokens = [];
      window.__tokenConfig = {};
      renderTokens(); renderTokenConfig();
      openProfileEditor("New Profile");
      profileTitleEl.focus();
    });
    profileDescEl.addEventListener("input", () => {
      profileDescCount.textContent = profileDescEl.value.length;
    });

    $("saveProfileBtn").addEventListener("click", () => {
      const d = getCurrentDraft();
      if (!d.title) { showError("Profile title is required"); return; }
      const idx = profiles.findIndex((x) => x.id === d.id);
      if (idx >= 0) profiles[idx] = { ...profiles[idx], ...d };
      else { d.createdAt = d.updatedAt; profiles.push(d); }
      currentProfileId = d.id;
      saveProfiles();
      profilesPanel.classList.remove("hidden");
      profileEditor.classList.add("hidden");
      showError("Profile saved");
    });

    $("cancelProfileBtn").addEventListener("click", () => {
      profileEditor.classList.add("hidden");
      profilesPanel.classList.remove("hidden");
    });

    $("addFolderBtn").addEventListener("click", () => {
      const input = $("newFolderName");
      const folder = input.value.trim();
      if (!folder) {
        showError("Folder name is required.");
        return;
      }
      if (folders.some((existing) => existing.toLowerCase() === folder.toLowerCase())) {
        showError("A folder with that name already exists.");
        return;
      }
      folders.push(folder);
      input.value = "";
      saveFolders();
      profileFolderEl.value = folder;
      showError("Folder added.");
    });

    // Tokens
    window.__tokens = [];
    window.__tokenConfig = {};
    function renderTokens() {
      tokensListEl.innerHTML = "";
      window.__tokens.forEach((t, i) => {
        const row = document.createElement("div");
        row.style.display = "flex"; row.style.gap = "8px"; row.style.alignItems = "center"; row.style.marginBottom = "6px";
        const inp = document.createElement("input");
        inp.type = "text"; inp.value = t; inp.placeholder = `Token ${i+1}`;
        inp.addEventListener("input", () => {
          const old = window.__tokens[i];
          window.__tokens[i] = inp.value;
          if (old && old !== inp.value) {
            if (window.__tokenConfig[old] && !window.__tokenConfig[inp.value]) window.__tokenConfig[inp.value] = window.__tokenConfig[old];
            delete window.__tokenConfig[old];
          }
          if (window.__tokens.length === 1) tokenEl.value = window.__tokens[0] || "";
          renderTokenConfig();
        });
        const rm = document.createElement("button");
        rm.className = "btn-secondary"; rm.textContent = "Remove"; rm.style.padding = "6px 10px";
        rm.addEventListener("click", () => {
          const old = window.__tokens.splice(i,1)[0];
          if (old) delete window.__tokenConfig[old];
          renderTokens(); renderTokenConfig();
        });
        row.appendChild(inp); row.appendChild(rm);
        tokensListEl.appendChild(row);
      });
      if (window.__tokens.length === 0) {
        const d = document.createElement("div"); d.className = "helper-text"; d.textContent = "No tokens added yet"; tokensListEl.appendChild(d);
      }
      tokenEl.value = window.__tokens.length === 1 ? (window.__tokens[0] || "") : tokenEl.value;
    }
    function renderTokenConfig() {
      tokenConfigContainer.innerHTML = "";
      const list = window.__tokens.filter(Boolean);
      if (list.length === 0) {
        const d = document.createElement("div"); d.className = "helper-text"; d.textContent = "Add tokens to configure"; tokenConfigContainer.appendChild(d);
        return;
      }
      list.forEach((t) => {
        const key = t.trim();
        if (!window.__tokenConfig[key]) {
          window.__tokenConfig[key] = { mode: "userInput", inputType: "multiple", value: "", values: "" };
        }
        const cfg = window.__tokenConfig[key];
        const card = document.createElement("div"); card.className = "token-card";
        const h = document.createElement("div"); h.className = "token-header";
        const ttl = document.createElement("div"); ttl.className = "token-title"; ttl.textContent = key;
        const sel = document.createElement("select");
        ["fixed","predefined","userInput"].forEach((m) => { const o=document.createElement("option"); o.value=m; o.textContent=m; sel.appendChild(o); });
        sel.value = cfg.mode || "userInput";
        sel.addEventListener("change", () => { cfg.mode = sel.value; renderTokenConfig(); });
        h.appendChild(ttl); h.appendChild(sel); card.appendChild(h);
        const body = document.createElement("div"); body.className = "token-body";
        if (cfg.mode === "fixed") {
          const inp = document.createElement("input"); inp.type="text"; inp.placeholder="Fixed value"; inp.value = cfg.value || "";
          inp.addEventListener("input", () => { cfg.value = inp.value; });
          body.appendChild(inp);
        } else if (cfg.mode === "predefined") {
          const ta = document.createElement("textarea"); ta.placeholder="one per line\nvalue1\nvalue2"; ta.value = cfg.values || "";
          ta.addEventListener("input", () => { cfg.values = ta.value; });
          body.appendChild(ta);
        } else {
          const s2 = document.createElement("select");
          [["multiple","Multiple (one per line)"],["single","Single (one value)"]].forEach(([v,l])=>{ const o=document.createElement("option"); o.value=v; o.textContent=l; s2.appendChild(o); });
          s2.value = cfg.inputType || "multiple";
          s2.addEventListener("change", () => { cfg.inputType = s2.value; });
          body.appendChild(s2);
          const hint = document.createElement("div"); hint.className="helper-text"; hint.textContent="Entered in Usage page";
          body.appendChild(hint);
        }
        card.appendChild(body);
        tokenConfigContainer.appendChild(card);
      });
    }

    $("addTokenBtn").addEventListener("click", () => {
      window.__tokens.push("");
      renderTokens(); renderTokenConfig();
    });
    $("clearTokensBtn").addEventListener("click", () => {
      window.__tokens = []; window.__tokenConfig = {}; renderTokens(); renderTokenConfig();
    });
    tokenEl.addEventListener("input", () => {
      if (window.__tokens.length <= 1) {
        if (window.__tokens.length === 0) window.__tokens = [tokenEl.value];
        else window.__tokens[0] = tokenEl.value;
        renderTokens(); renderTokenConfig();
      }
    });

    if ($("usageView")) {
    // USAGE
    function loadUsageProfile(p) {
      currentUsageProfile = JSON.parse(JSON.stringify(p));
      usageProfileTitle.textContent = p.title || "Untitled";
      usageProfileDesc.textContent = p.description || "";
      usageProfileMeta.innerHTML = "";
      if (p.baseUrl) { const c=document.createElement("span"); c.className="chip"; c.textContent="Has Base URL"; usageProfileMeta.appendChild(c); }
      if (p.tokens && p.tokens.length) { const c=document.createElement("span"); c.className="chip"; c.textContent=p.tokens.length+" token(s)"; usageProfileMeta.appendChild(c); }
      profileInfo.classList.remove("hidden");
      renderUsageInputs();
      usageInputsCard.classList.remove("hidden");
    }

    $("loadProfileIntoUsageBtn").addEventListener("click", () => {
      const id = usageProfileSelect.value;
      const p = profiles.find((x)=>x.id===id);
      if (!p) return; loadUsageProfile(p);
    });

    $("importProfileUsageInput").addEventListener("change", (e)=>{
      const f=e.target.files[0]; if(!f) return;
      const r=new FileReader();
      r.onload=()=>{
        try {
          const j=JSON.parse(r.result);
          if (j.id) loadUsageProfile(j);
          else if (j.profiles && j.profiles[0]) loadUsageProfile(j.profiles[0]);
          showError("Profile loaded for usage");
        } catch(e){ showError("Invalid JSON"); }
      };
      r.readAsText(f); e.target.value="";
    });
    $("importProfileUsageBtn").addEventListener("click", ()=> $("importProfileUsageInput").click());

    function renderUsageInputs() {
      usageInputsContainer.innerHTML = "";
      if (!currentUsageProfile) return;
      const toks = currentUsageProfile.tokens || [];
      toks.forEach((t)=>{
        const key = (t||"").trim(); if(!key) return;
        const cfg = (currentUsageProfile.tokenConfig||{})[key] || {mode:"userInput",inputType:"multiple"};
        if (cfg.mode !== "userInput") {
          const box = document.createElement("div"); box.className="usage-input";
          const lab = document.createElement("label"); lab.textContent = key + " (read-only • " + cfg.mode + ")";
          const inp = document.createElement("input"); inp.type="text"; inp.readOnly=true;
          if (cfg.mode==="fixed") inp.value = cfg.value || "";
          else inp.value = (cfg.values||"").split(/\n+/).filter(Boolean).join(", ");
          box.appendChild(lab); box.appendChild(inp);
          usageInputsContainer.appendChild(box);
        } else {
          const box = document.createElement("div"); box.className="usage-input";
          const lab = document.createElement("label"); lab.textContent = key;
          const it = cfg.inputType || "multiple";
          if (it === "single") {
            const inp = document.createElement("input"); inp.type="text"; inp.placeholder="Value"; inp.dataset.token=key; inp.dataset.type="single";
            box.appendChild(lab); box.appendChild(inp);
          } else {
            const ta = document.createElement("textarea"); ta.placeholder="one per line"; ta.dataset.token=key; ta.dataset.type="multiple";
            box.appendChild(lab); box.appendChild(ta);
          }
          const h = document.createElement("div"); h.className="helper-text"; h.textContent = it==="single"?"Single value for all links":"One per line → combinations";
          box.appendChild(h);
          usageInputsContainer.appendChild(box);
        }
      });
      if (usageInputsContainer.children.length === 0) {
        const d=document.createElement("div"); d.className="helper-text"; d.textContent="No inputs required for this profile"; usageInputsContainer.appendChild(d);
      }
    }

    $("clearUsageInputsBtn").addEventListener("click", ()=>{
      usageInputsContainer.querySelectorAll("input,textarea").forEach((el)=> el.value="");
    });

    function getUsageValues() {
      const res = {};
      usageInputsContainer.querySelectorAll("[data-token]").forEach((el)=>{
        const k = el.dataset.token; const t = el.dataset.type;
        if (t==="single") res[k] = el.value;
        else res[k] = el.value;
      });
      return res;
    }

    $("generateUsageBtn").addEventListener("click", ()=>{
      if (!currentUsageProfile) { showError("Load a profile first"); return; }
      const base = (currentUsageProfile.baseUrl||"").trim();
      if (!base) { showError("Profile has no Base URL"); return; }
      const toks = currentUsageProfile.tokens || [];
      const cfg = currentUsageProfile.tokenConfig || {};
      const uvals = getUsageValues();
      let lists = [];
      for (const t of toks) {
        const key=(t||"").trim(); if(!key) continue;
        const c = cfg[key] || {mode:"userInput",inputType:"multiple"};
        let vals=[];
        if (c.mode==="fixed") {
          const v=(c.value||"").trim(); if(v==="") { showError(`Fixed value missing for ${key}`); return; } vals=[v];
        } else if (c.mode==="predefined") {
          vals = (c.values||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
          if (vals.length===0) { showError(`Predefined values missing for ${key}`); return; }
        } else {
          const it=c.inputType||"multiple";
          if (it==="single") {
            const v=(uvals[key]||"").trim(); if(v==="") { showError(`Value required for ${key}`); return; } vals=[v];
          } else {
            vals = (uvals[key]||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
            if (vals.length===0) { showError(`Values required for ${key}`); return; }
          }
        }
        lists.push({token:key, values:vals});
      }
      let combos=[]; function cart(i, cur){ if(i===lists.length){ combos.push({...cur}); return;} const L=lists[i]; for(let j=0;j<L.values.length;j++){ cur[L.token]=L.values[j]; cart(i+1,cur);} } cart(0,{});
      usageGenerated=[];
      let valid=0, openNew = currentUsageProfile.openInNewTab!==false;
      for (const co of combos) {
        let url=base;
        for (const t of toks) {
          const key=(t||"").trim(); if(!key) continue;
          const v=co[key];
          if (v===undefined) continue;
          const enc=encodeURIComponent(v);
          url = url.split(key).join(enc);
        }
        try { new URL(url); valid++; } catch(e){}
        const label = Object.values(co).join(" | ");
        usageGenerated.push({original:label, url, combo:co});
      }
      renderUsageOutput(valid, openNew);
    });

    function renderUsageOutput(valid, openNew) {
      usageOutput.innerHTML="";
      linkCountEl.textContent = usageGenerated.length + (usageGenerated.length===1?" link":" links");
      validCountEl.textContent = valid + " valid";
      copyAllUsageBtn.disabled = usageGenerated.length===0;
      usageGenerated.forEach((item,i)=>{
        const div=document.createElement("div"); div.className="link-item";
        div.innerHTML = `
          <div class="link-content">
            <div class="link-label">#${i+1} • ${escapeHtml(item.original)}</div>
            <a href="${escapeAttr(item.url)}" class="link-url" ${openNew?'target="_blank" rel="noopener noreferrer"':''}>${escapeHtml(item.url)}</a>
          </div>
          <div class="link-actions">
            <button class="icon-btn" data-act="copy" data-url="${escapeAttr(item.url)}">Copy</button>
            <button class="icon-btn" data-act="open" data-url="${escapeAttr(item.url)}">Open</button>
          </div>`;
        usageOutput.appendChild(div);
      });
    }

    function escapeHtml(t){ const d=document.createElement("div"); d.textContent=t; return d.innerHTML; }
    function escapeAttr(t){ return t.replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

    usageOutput.addEventListener("click",(e)=>{
      const b=e.target.closest("button"); if(!b) return;
      const act=b.dataset.act, url=b.dataset.url;
      if (act==="copy") { navigator.clipboard.writeText(url).then(()=>{ const o=b.textContent; b.textContent="Copied"; setTimeout(()=>b.textContent=o,1200); }); }
      if (act==="open") {
        const openNew = currentUsageProfile ? currentUsageProfile.openInNewTab!==false : true;
        if (openNew) window.open(url,"_blank","noopener,noreferrer");
        else window.open(url,"_self");
      }
    });
    copyAllUsageBtn.addEventListener("click",()=>{
      const txt = usageGenerated.map(x=>x.url).join("\n");
      navigator.clipboard.writeText(txt).then(()=>{ const o=copyAllUsageBtn.textContent; copyAllUsageBtn.textContent="Copied!"; setTimeout(()=>copyAllUsageBtn.textContent=o,1500); });
    });
    $("clearUsageLinksBtn").addEventListener("click",()=>{ usageGenerated=[]; renderUsageOutput(0,true); });

    }

    initTheme();
    window.__tokens = []; window.__tokenConfig = {};
    loadProfiles();
