import { confirm } from "@tauri-apps/plugin-dialog";
import { toastError, toastInfo, toastWarning } from "@/lib/app-toast";
import { isMudirDesktop } from "@/lib/runtime";

function webConfirm(body: string, title?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999";

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "alertdialog");
    dialog.style.cssText =
      "background:var(--background,#fff);color:var(--foreground,#111);padding:1.25rem;border-radius:.75rem;max-width:24rem;width:calc(100% - 2rem);box-shadow:0 10px 30px rgba(0,0,0,.2)";

    const heading = document.createElement("h2");
    heading.textContent = title ?? "Confirm";
    heading.style.cssText = "margin:0 0 .75rem;font-size:1rem;font-weight:600";

    const messageEl = document.createElement("p");
    messageEl.textContent = body;
    messageEl.style.cssText = "margin:0 0 1rem;line-height:1.5";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:.5rem;justify-content:flex-end";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.textContent = "OK";

    const close = (value: boolean) => {
      overlay.remove();
      resolve(value);
    };

    cancelButton.addEventListener("click", () => {
      close(false);
    });
    confirmButton.addEventListener("click", () => {
      close(true);
    });

    actions.append(cancelButton, confirmButton);
    dialog.append(heading, messageEl, actions);
    overlay.append(dialog);
    document.body.append(overlay);
    confirmButton.focus();
  });
}

export function confirmAction(body: string, title?: string): Promise<boolean> {
  if (isMudirDesktop()) {
    return confirm(body, { kind: "warning", title });
  }
  return webConfirm(body, title);
}

export function alertAction(
  body: string,
  _title?: string,
  kind: "info" | "error" | "warning" = "info"
): Promise<void> {
  if (kind === "error") {
    toastError(body);
  } else if (kind === "warning") {
    toastWarning(body);
  } else {
    toastInfo(body);
  }
  return Promise.resolve();
}
