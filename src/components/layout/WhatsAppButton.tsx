import atendenteImg from "@/assets/atendente-webmarcas.png";

const WhatsAppButton = () => {
  const whatsappUrl =
    "https://api.whatsapp.com/send/?phone=5511911120225&text=Ol%C3%A1%21+Estava+no+site+da+WebMarcas+e+quero+registrar+minha+marca.&type=phone_number&app_absent=0";

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco no WhatsApp com uma atendente"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.45)] hover:scale-105 transition-transform animate-pulse-glow group"
    >
      <span className="relative">
        <img
          src={atendenteImg}
          alt="Atendente WebMarcas"
          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
          style={{ objectPosition: "50% 20%" }}
        />
        <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
      </span>
      <svg
        viewBox="0 0 32 32"
        className="w-7 h-7 text-white"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19.11 17.21c-.29-.15-1.7-.84-1.96-.93-.26-.1-.45-.15-.64.14-.19.29-.74.93-.9 1.12-.17.19-.33.21-.62.07-.29-.15-1.22-.45-2.32-1.43-.86-.76-1.43-1.7-1.6-1.99-.17-.29-.02-.45.13-.6.13-.13.29-.33.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.39 0 1.41 1.02 2.77 1.17 2.96.14.19 2.02 3.08 4.89 4.32.68.29 1.21.47 1.62.6.68.22 1.3.19 1.79.12.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34zM16.02 5.33c-5.89 0-10.67 4.78-10.67 10.67 0 1.88.49 3.71 1.42 5.33L5.33 26.67l5.5-1.43c1.56.85 3.32 1.3 5.18 1.3h.01c5.89 0 10.67-4.78 10.67-10.67 0-2.85-1.11-5.53-3.13-7.55a10.6 10.6 0 0 0-7.54-3.12zm0 19.55h-.01a8.85 8.85 0 0 1-4.51-1.24l-.32-.19-3.27.85.87-3.18-.21-.33a8.86 8.86 0 0 1-1.36-4.71c0-4.9 3.99-8.88 8.89-8.88 2.37 0 4.6.93 6.28 2.6a8.83 8.83 0 0 1 2.6 6.29c0 4.9-3.99 8.89-8.88 8.89z"/>
      </svg>
    </a>
  );
};

export default WhatsAppButton;
