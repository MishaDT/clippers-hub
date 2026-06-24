"use client";

import { useEffect, useState } from "react";

const options: Array<[string, string]> = [
  ["", "Aurora"],
  ["mono", "Mono"],
  ["indigo", "Indigo"]
];

export function ThemeSwitch() {
  const [theme, setTheme] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("reelpay-theme") || "";
    setTheme(saved);
    if (saved) document.documentElement.dataset.theme = saved;
  }, []);

  function apply(value: string) {
    setTheme(value);
    if (value) document.documentElement.dataset.theme = value;
    else delete document.documentElement.dataset.theme;
    localStorage.setItem("reelpay-theme", value);
  }

  return (
    <div className="theme-switch" role="group" aria-label="Тема оформления">
      {options.map(([value, label]) => (
        <button key={value || "default"} type="button" className={theme === value ? "active" : ""} onClick={() => apply(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}
