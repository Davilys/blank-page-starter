import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Search, Tag, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { blogPosts } from "@/data/blogPosts";
import { Input } from "@/components/ui/input";

const categories = ["Todos", ...Array.from(new Set(blogPosts.map((p) => p.category)))];

const Blog = () => {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");

  const filtered = blogPosts.filter((post) => {
    const matchCat = activeCategory === "Todos" || post.category === activeCategory;
    const matchSearch =
      !search ||
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      post.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 md:pt-24">
        {/* Hero */}
        <section className="relative overflow-hidden py-16 md:py-24">
          {/* Decorative background */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.06] rounded-full blur-[120px]" />

          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto mb-10"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                Blog WebMarcas
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-bold mb-5 tracking-tight">
                Conhecimento em{" "}
                <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                  Registro de Marcas
                </span>
              </h1>
              <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                Artigos, guias e estratégias para proteger sua marca e impulsionar seu negócio.
              </p>
            </motion.div>

            {/* Search & Filters */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="max-w-4xl mx-auto mb-12"
            >
              <div className="relative mb-5">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar artigos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11 h-12 rounded-2xl bg-card border-border/60 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      activeCategory === cat
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Featured Post */}
            {featured && (
              <Link to={`/blog/${featured.slug}`}>
                <motion.article
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.5 }}
                  className="max-w-5xl mx-auto rounded-3xl overflow-hidden border border-border/40 bg-card shadow-xl hover:shadow-2xl transition-all duration-500 group"
                >
                  <div className="md:flex">
                    <div className="md:w-3/5 h-72 md:h-[420px] overflow-hidden relative">
                      <img
                        src={featured.image}
                        alt={featured.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="eager"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/20 md:bg-gradient-to-l md:from-card/10 md:to-transparent" />
                    </div>
                    <div className="md:w-2/5 p-8 md:p-10 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                          {featured.category}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {featured.readTime}
                        </span>
                      </div>
                      <h2 className="font-display text-2xl md:text-3xl font-bold mb-4 group-hover:text-primary transition-colors duration-300 leading-tight">
                        {featured.title}
                      </h2>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-6 line-clamp-3">
                        {featured.description}
                      </p>
                      <span className="inline-flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all duration-300">
                        Ler artigo completo
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </motion.article>
              </Link>
            )}
          </div>
        </section>

        {/* Grid */}
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            {rest.length === 0 && filtered.length <= 1 && (
              <p className="text-center text-muted-foreground py-12">
                {filtered.length === 0
                  ? "Nenhum artigo encontrado."
                  : ""}
              </p>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
              {rest.map((post, i) => (
                <motion.article
                  key={post.slug}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.5 }}
                >
                  <Link
                    to={`/blog/${post.slug}`}
                    className="group block rounded-2xl overflow-hidden border border-border/40 bg-card hover:shadow-xl transition-all duration-500 h-full"
                  >
                    <div className="h-52 overflow-hidden relative">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute top-3 left-3">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-card/90 backdrop-blur-sm text-primary border border-primary/10 uppercase tracking-wider">
                          {post.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-5 md:p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {post.readTime}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(post.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-base mb-2 group-hover:text-primary transition-colors duration-300 line-clamp-2 leading-snug">
                        {post.title}
                      </h3>
                      <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-4">
                        {post.description}
                      </p>
                      <span className="inline-flex items-center gap-1 text-primary text-xs font-semibold group-hover:gap-2 transition-all duration-300">
                        Ler mais <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.04] to-background" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/[0.06] rounded-full blur-[100px]" />
          <div className="container mx-auto px-4 text-center max-w-2xl relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-5 tracking-tight">
                Proteja sua marca{" "}
                <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                  agora
                </span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Faça a consulta de viabilidade gratuita e receba um laudo técnico em minutos.
              </p>
              <Link
                to="/#consultar"
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 duration-300"
              >
                Consultar Viabilidade Grátis
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Blog;
