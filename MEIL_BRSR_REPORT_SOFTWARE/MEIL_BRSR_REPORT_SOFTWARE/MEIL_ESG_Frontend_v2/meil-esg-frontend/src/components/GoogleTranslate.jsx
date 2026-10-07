import { useEffect, useState, useRef } from "react";
import { Globe } from "lucide-react";

const GoogleTranslate = () => {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        window.googleTranslateElementInit = () => {
            if (
                window.google &&
                window.google.translate &&
                document.getElementById("google_translate_element")
            ) {
                new window.google.translate.TranslateElement(
                    {
                        pageLanguage: "en",
                        includedLanguages:
                            "en,hi,or,bn,te,ta,mr,gu,kn,ml,pa,ur",
                        autoDisplay: false,
                    },
                    "google_translate_element"
                );
            }
        };

        if (!document.querySelector(
            'script[src*="translate.google.com/translate_a/element.js"]'
        )) {
            const script = document.createElement("script");

            script.src =
                "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";

            script.async = true;

            document.body.appendChild(script);
        }

        return () => {
            delete window.googleTranslateElementInit;
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const changeLanguage = (language) => {
        const select = document.querySelector(".goog-te-combo");

        if (!select) {
            console.warn("Google Translate is not ready yet.");
            return;
        }

        select.value = language;
        select.dispatchEvent(new Event("change"));

        setOpen(false);
    };

    return (
        <div
            className="relative"
            ref={dropdownRef}
        >
            {/* Language Selector */}
            <button
                type="button"
                onClick={() => setOpen((previous) => !previous)}
                className="flex items-center gap-1.5 hover:text-sky-600 transition text-sm font-semibold"
                aria-label="Select language"
                aria-expanded={open}
            >
                <Globe size={18} />
                <span>EN</span>
            </button>

            {/* Language Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-3 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50">
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                            Select Language
                        </p>
                    </div>

                    <div className="max-h-72 overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => changeLanguage("en")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            EN (English)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("hi")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            HI (हिन्दी)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("or")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            OD (ଓଡ଼ିଆ)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("bn")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            BN (বাংলা)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("te")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            TE (తెలుగు)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("ta")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            TA (தமிழ்)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("mr")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            MR (मराठी)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("gu")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            GU (ગુજરાતી)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("kn")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            KN (ಕನ್ನಡ)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("ml")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            ML (മലയാളം)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("pa")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            PA (ਪੰਜਾਬੀ)
                        </button>

                        <button
                            type="button"
                            onClick={() => changeLanguage("ur")}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 hover:text-sky-600 transition"
                        >
                            UR (اردو)
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden Google Translate element */}
            <div
                id="google_translate_element"
                className="hidden"
            />
        </div>
    );
};

export default GoogleTranslate;