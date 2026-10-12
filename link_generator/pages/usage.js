const PROFILES_KEY = "lgProfilesV3";
    const FOLDERS_KEY = "lgFoldersV1";
    const THEME_KEY = "lgTheme";
    const $ = (id) => document.getElementById(id);
    const folderSelect = $("folderSelect");
    const profileSelect = $("profileSelect");
    const inputsContainer = $("inputsContainer");
    const output = $("output");
    const errorBox = $("errorBox");
    const themeToggle = $("themeToggle");
    const themeLabel = $("themeLabel");
    let currentProfile = null;
    let generated = [];
    let sharedProfiles = [];

    function showError(message) {
      errorBox.textContent = message;
      errorBox.classList.remove("hidden");
    }

    function readProfiles() {
      try {
        const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]");
        return Array.isArray(profiles) ? profiles : [];
      } catch (error) {
        showError("Saved profiles could not be read. Try importing the profile JSON.");
        return [];
      }
    }

    function readFolders() {
      try {
        const storedFolders = JSON.parse(localStorage.getItem(FOLDERS_KEY) || '["General"]');
        if (!Array.isArray(storedFolders)) return ["General"];
        return [...new Set(["General", ...storedFolders.filter((folder) => typeof folder === "string" && folder.trim()).map((folder) => folder.trim())])];
      } catch (error) {
        showError("Saved folders could not be read. Profiles are grouped in the default folder.");
        return ["General"];
      }
    }

    function getAvailableProfiles() {
      const profiles = [...readProfiles()];
      sharedProfiles.forEach((shared) => {
        const existingIndex = profiles.findIndex((profile) => profile.id === shared.id);
        if (existingIndex >= 0) profiles[existingIndex] = shared;
        else profiles.push(shared);
      });
      return profiles;
    }

    function renderFolders(selectedFolder = folderSelect.value || "*") {
      const profiles = getAvailableProfiles();
      const folders = [...new Set([
        ...readFolders(),
        ...profiles.map((profile) => profile.folder || "General"),
      ])].filter((folder) => folder !== "General");
      folderSelect.replaceChildren(new Option("All folders", "*"));
      folders.forEach((folder) => folderSelect.add(new Option(folder, folder)));
      folderSelect.value = folders.includes(selectedFolder) || selectedFolder === "*" ? selectedFolder : "*";
    }

    function renderProfiles(selectedId = "", selectedFolder = folderSelect.value || "*") {
      const profiles = getAvailableProfiles();
      renderFolders(selectedFolder);
      profileSelect.replaceChildren(new Option("-- Select Profile --", ""));
      const visibleProfiles = profiles.filter((profile) =>
        profile && profile.id && (folderSelect.value === "*" || (profile.folder || "General") === folderSelect.value)
      );
      visibleProfiles.forEach((profile) => {
        profileSelect.add(new Option(profile.title || "Untitled", profile.id));
      });
      if (selectedId && visibleProfiles.some((profile) => profile.id === selectedId)) {
        profileSelect.value = selectedId;
      }

      const profileCount = visibleProfiles.length;
      const availability = $("profileAvailability");
      availability.classList.toggle("hidden", profileCount > 0);
      availability.textContent = profileCount
        ? ""
        : (folderSelect.value === "*"
          ? "No profiles are available. Open Generate Links from Configuration or import a profile JSON file."
          : `No profiles are saved in the ${folderSelect.value} folder.`);
    }

    function loadProfile(profile) {
      if (!profile || typeof profile !== "object") {
        showError("The selected profile is invalid.");
        return;
      }
      currentProfile = profile;
      $("profileTitle").textContent = profile.title || "Untitled";
      $("profileDescription").textContent = profile.description || "";
      $("profileFolder").textContent = `Folder: ${profile.folder && profile.folder !== "General" ? profile.folder : "Default folder"}`;
      $("profileInfo").classList.remove("hidden");
      renderInputs();
      errorBox.classList.add("hidden");
      clearResults();
    }

    function renderInputs() {
      inputsContainer.replaceChildren();
      const tokens = Array.isArray(currentProfile.tokens) ? currentProfile.tokens : [];
      const config = currentProfile.tokenConfig || {};
      let inputCount = 0;

      tokens.forEach((token) => {
        const key = (token || "").trim();
        if (!key) return;
        inputCount += 1;
        const cfg = config[key] || { mode: "userInput", inputType: "multiple" };
        const group = document.createElement("div");
        group.className = "usage-input";
        const label = document.createElement("label");
        label.textContent = key;
        group.appendChild(label);

        if (cfg.mode === "fixed" || cfg.mode === "predefined") {
          const field = document.createElement("input");
          field.readOnly = true;
          field.value = cfg.mode === "fixed"
            ? (cfg.value || "")
            : (cfg.values || "").split(/\r?\n/).filter(Boolean).join(", ");
          group.appendChild(field);
          const helper = document.createElement("div");
          helper.className = "helper";
          helper.textContent = cfg.mode === "fixed" ? "Fixed in this profile." : "Predefined values from this profile.";
          group.appendChild(helper);
        } else {
          const field = document.createElement(cfg.inputType === "single" ? "input" : "textarea");
          field.dataset.token = key;
          field.placeholder = cfg.inputType === "single" ? "Enter a value" : "Enter one value per line";
          group.appendChild(field);
          const helper = document.createElement("div");
          helper.className = "helper";
          helper.textContent = cfg.inputType === "single" ? "One value will be used for all generated links." : "Each line is a value; lines combine with other inputs.";
          group.appendChild(helper);
        }
        inputsContainer.appendChild(group);
      });

      if (!inputCount) inputsContainer.textContent = "This profile has no token inputs.";
    }

    function valuesFor(token, cfg) {
      if (cfg.mode === "fixed") {
        const value = (cfg.value || "").trim();
        if (!value) throw new Error(`Fixed value missing for ${token}`);
        return [value];
      }
      if (cfg.mode === "predefined") {
        const values = (cfg.values || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
        if (!values.length) throw new Error(`Predefined values missing for ${token}`);
        return values;
      }
      const field = [...inputsContainer.querySelectorAll("[data-token]")].find((item) => item.dataset.token === token);
      const values = cfg.inputType === "single"
        ? [(field?.value || "").trim()].filter(Boolean)
        : (field?.value || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
      if (!values.length) throw new Error(`Enter a value for ${token}`);
      return values;
    }

    function makeCombinations(lists, index = 0, current = {}) {
      if (index === lists.length) return [current];
      const { token, values } = lists[index];
      return values.flatMap((value) => makeCombinations(lists, index + 1, { ...current, [token]: value }));
    }

    function clearResults() {
      generated = [];
      output.replaceChildren();
      $("linkStats").textContent = "0 iterations · 0 links";
      $("copyAllBtn").disabled = true;
    }

    function generateLinks() {
      if (!currentProfile) {
        showError("Select a profile first.");
        return;
      }
      const baseUrls = Array.isArray(currentProfile.baseUrls)
        ? currentProfile.baseUrls.map((url) => url.trim()).filter(Boolean)
        : [currentProfile.baseUrl || ""].map((url) => url.trim()).filter(Boolean);
      if (!baseUrls.length) {
        showError("This profile does not have any base links.");
        return;
      }

      try {
        const config = currentProfile.tokenConfig || {};
        const tokens = (currentProfile.tokens || []).map((token) => (token || "").trim()).filter(Boolean);
        const lists = tokens.map((token) => ({
          token,
          values: valuesFor(token, config[token] || { mode: "userInput", inputType: "multiple" }),
        }));
        const combinations = makeCombinations(lists);
        generated = combinations.flatMap((combination, iterationIndex) => baseUrls.map((baseUrl, linkIndex) => {
          let url = baseUrl;
          tokens.forEach((token) => {
            if (combination[token] !== undefined) {
              url = url.split(token).join(encodeURIComponent(combination[token]));
            }
          });
          return { combination, url, linkIndex, iterationIndex };
        }));
        renderResults();
        errorBox.classList.add("hidden");
      } catch (error) {
        showError(error.message);
      }
    }

    function renderResults() {
      output.replaceChildren();
      const iterations = [...new Set(generated.map((item) => item.iterationIndex))];
      $("linkStats").textContent = `${iterations.length} ${iterations.length === 1 ? "iteration" : "iterations"} · ${generated.length} ${generated.length === 1 ? "link" : "links"}`;
      $("copyAllBtn").disabled = generated.length === 0;
      iterations.forEach((iterationIndex) => {
        const iterationLinks = generated.filter((item) => item.iterationIndex === iterationIndex);
        const group = document.createElement("section");
        group.className = "iteration-group";
        const header = document.createElement("div");
        header.className = "iteration-header";
        const heading = document.createElement("div");
        const title = document.createElement("div");
        title.className = "iteration-title";
        title.textContent = `Iteration ${iterationIndex + 1}`;
        const values = document.createElement("div");
        values.className = "iteration-values";
        values.textContent = Object.entries(iterationLinks[0].combination)
          .map(([token, value]) => `${token}: ${value}`).join("  ·  ") || "Same values for all links";
        heading.append(title, values);
        const copyIteration = document.createElement("button");
        copyIteration.type = "button";
        copyIteration.className = "secondary";
        copyIteration.textContent = "Copy Iteration";
        copyIteration.addEventListener("click", () => copyText(formatIteration(iterationIndex, iterationLinks), copyIteration));
        header.append(heading, copyIteration);
        group.appendChild(header);

        iterationLinks.forEach(({ url, linkIndex }) => {
          const item = document.createElement("div");
          item.className = "link-item";
          const content = document.createElement("div");
          content.className = "link-content";
          const label = document.createElement("div");
          label.className = "link-label";
          label.textContent = `Link ${linkIndex + 1}`;
          const anchor = document.createElement("a");
          anchor.className = "link-url";
          anchor.href = url;
          anchor.textContent = url;
          if (currentProfile.openInNewTab !== false) {
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
          }
          content.append(label, anchor);
          const actions = document.createElement("div");
          actions.className = "link-actions";
          const copy = document.createElement("button");
          copy.type = "button";
          copy.textContent = "Copy Link";
          copy.addEventListener("click", () => copyText(url, copy));
          actions.appendChild(copy);
          item.append(content, actions);
          group.appendChild(item);
        });
        output.appendChild(group);
      });
    }

    function formatIteration(iterationIndex, links) {
      const combinationLabel = Object.entries(links[0].combination)
        .map(([token, value]) => `${token}: ${value}`).join(" | ");
      return [`Iteration ${iterationIndex + 1}${combinationLabel ? ` — ${combinationLabel}` : ""}`, ...links.map((item) => item.url)].join("\n");
    }

    async function copyText(text, button) {
      try {
        await navigator.clipboard.writeText(text);
        const originalText = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => { button.textContent = originalText; }, 1200);
        errorBox.classList.add("hidden");
      } catch (error) {
        showError("Could not copy to clipboard. Check browser clipboard permissions.");
      }
    }

    function decodeSharedProfiles() {
      const params = new URLSearchParams(location.hash.slice(1).replace(/^usage&/, ""));
      const profilesEncoded = params.get("profiles");
      if (profilesEncoded) {
        try {
          const profiles = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(profilesEncoded)))));
          if (!Array.isArray(profiles)) throw new Error("Shared profiles are not a list.");
          return {
            profiles: profiles.filter((profile) => profile && typeof profile === "object" && profile.id),
            selectedId: params.get("selected"),
          };
        } catch (error) {
          showError("The shared profiles link is invalid.");
          return null;
        }
      }

      const profileEncoded = params.get("profile");
      if (!profileEncoded) return null;
      try {
        const profile = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(profileEncoded)))));
        return { profiles: profile?.id ? [profile] : [], selectedId: profile?.id || null };
      } catch (error) {
        showError("The shared profile link is invalid.");
        return null;
      }
    }

    profileSelect.addEventListener("change", () => {
      errorBox.classList.add("hidden");
      const profile = getAvailableProfiles().find((item) => item.id === profileSelect.value);
      if (profile) loadProfile(profile);
      else {
        currentProfile = null;
        $("profileInfo").classList.add("hidden");
        inputsContainer.textContent = "Select a profile to show its inputs.";
        clearResults();
      }
    });
    window.addEventListener("storage", (event) => {
      if (event.key === PROFILES_KEY || event.key === FOLDERS_KEY) {
        renderProfiles(profileSelect.value);
      }
    });
    window.addEventListener("focus", () => {
      const selectedId = profileSelect.value;
      renderProfiles(selectedId, folderSelect.value);
    });
    $("generateBtn").addEventListener("click", generateLinks);
    $("clearBtn").addEventListener("click", () => {
      inputsContainer.querySelectorAll("input:not([readonly]), textarea").forEach((field) => { field.value = ""; });
      clearResults();
      errorBox.classList.add("hidden");
    });
    $("copyAllBtn").addEventListener("click", () => {
      const iterations = [...new Set(generated.map((item) => item.iterationIndex))];
      const formatted = iterations.map((iterationIndex) => {
        const links = generated.filter((item) => item.iterationIndex === iterationIndex);
        return formatIteration(iterationIndex, links);
      }).join("\n\n");
      copyText(formatted, $("copyAllBtn"));
    });
    $("importProfileBtn").addEventListener("click", () => $("importProfileInput").click());
    $("importProfileInput").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          const profile = imported.id ? imported : imported.profiles?.[0];
          if (!profile?.id) throw new Error("JSON does not contain a profile.");
          if (!profile.folder) profile.folder = "General";
          sharedProfiles = [profile];
          renderProfiles(profile.id, profile.folder);
          loadProfile(profile);
        } catch (error) {
          showError(error.message || "Invalid profile JSON.");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    });

    function setTheme(theme) {
      document.documentElement.dataset.theme = theme;
      themeLabel.textContent = theme === "dark" ? "Dark" : "Light";
    }
    setTheme(localStorage.getItem(THEME_KEY) || "dark");
    themeToggle.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, nextTheme);
      setTheme(nextTheme);
    });
    renderProfiles("", "*");
    folderSelect.addEventListener("change", () => {
      const previousId = profileSelect.value;
      renderProfiles(previousId, folderSelect.value);
      if (!profileSelect.value) {
        currentProfile = null;
        $("profileInfo").classList.add("hidden");
        inputsContainer.textContent = "Select a profile to show its inputs.";
        clearResults();
      }
    });
    const shared = decodeSharedProfiles();
    if (shared?.profiles.length) {
      sharedProfiles = shared.profiles;
      const selectedProfile = shared.profiles.find((profile) => profile.id === shared.selectedId);
      const selectedFolder = selectedProfile?.folder || "*";
      renderProfiles(shared.selectedId || "", selectedFolder);
      if (shared.selectedId) {
        profileSelect.dispatchEvent(new Event("change"));
      } else if (shared.profiles.length === 1) {
        profileSelect.value = shared.profiles[0].id;
        profileSelect.dispatchEvent(new Event("change"));
      }
    } else if (profileSelect.querySelectorAll("option[value]:not([value=''])").length === 1) {
      profileSelect.value = profileSelect.querySelector("option[value]:not([value=''])").value;
      profileSelect.dispatchEvent(new Event("change"));
    }
