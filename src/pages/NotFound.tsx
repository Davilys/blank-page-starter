import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-muted-foreground mb-6">Página não encontrada</p>
        <Link to="/" className="text-primary hover:underline">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
