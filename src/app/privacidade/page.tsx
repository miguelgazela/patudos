import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, Section } from "@/components/publico/legal";

export const metadata: Metadata = {
  title: "Política de privacidade · Patudos",
  description:
    "Que dados guardamos no Patudos, para quê, onde ficam e quais são os teus direitos.",
  robots: { index: true, follow: true },
};

// Ecrã 34 (privacidade). Página pública e estática. Texto preenchido; falta revisão jurídica.
export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de privacidade"
      other={{ href: "/termos", label: "Ler os Termos de utilização" }}
    >
      <p className="text-tinta-suave">Última atualização: 23/11/2026</p>

      <Section title="Em resumo">
        <ul>
          <li>Guardamos só o que precisas para usar a app.</li>
          <li>Não vendemos os teus dados nem mostramos publicidade.</li>
          <li>Não usamos inteligência artificial sobre os teus dados.</li>
          <li>
            Os dados dos animais só são vistos por quem tem acesso a eles.
          </li>
          <li>Podes exportar tudo e apagar a conta quando quiseres.</li>
        </ul>
      </Section>

      <Section title="Quem é o responsável">
        <p>
          O responsável pelo tratamento dos dados é Miguel Oliveira. Contacto:{" "}
          <a href="mailto:patudos@miguelgazela.com">patudos@miguelgazela.com</a>
          .
        </p>
      </Section>

      <Section title="Que dados guardamos">
        <ul>
          <li>
            <b>Conta:</b> o teu email e o teu nome.
          </li>
          <li>
            <b>Animais:</b> nome, espécie, raça, sexo, data de nascimento, chip,
            cor e foto.
          </li>
          <li>
            <b>Saúde e registos:</b> consultas, vacinas, desparasitações,
            medicação, peso, notas e o veterinário.
          </li>
          <li>
            <b>Despesas:</b> valores, datas e categorias.
          </li>
          <li>
            <b>Documentos e fotos</b> que carregues (por exemplo, receitas ou
            boletins de vacinas).
          </li>
          <li>
            <b>Lembretes e preferências</b> de notificação.
          </li>
          <li>
            <b>Dados técnicos de notificações:</b> a subscrição de push do teu
            dispositivo, se ativares as notificações.
          </li>
          <li>
            <b>Calendário:</b> um código secreto que identifica o teu feed de
            calendário (.ics), se o usares.
          </li>
          <li>
            <b>Quem registou o quê:</b> cada registo guarda quem o criou.
          </li>
        </ul>
        <p>
          Não pedimos nem guardamos palavras-passe, dados de pagamento ou
          localização.
        </p>
      </Section>

      <Section title="Para que usamos e com que base legal">
        <p>
          Usamos os dados para prestar o serviço que pediste: mostrar os teus
          registos, enviar o código de entrada, os lembretes e os convites, e
          gerar a ficha em PDF. A base legal é a execução do serviço (contrato)
          que aceitas ao usar a app.
        </p>
      </Section>

      <Section title="Partilha com outras pessoas">
        <p>
          Cada animal tem os seus membros. Quem convidas como dono ou cuidador
          vê os registos, fotos, documentos e despesas <b>desse animal</b>, e vê
          o teu nome nos registos que fizeste. Não veem os teus outros animais.
          Os cuidadores criam registos e editam os que criaram; só o dono gere
          os membros e a ficha do animal.
        </p>
      </Section>

      <Section title="Quem trata dados por nós">
        <p>
          Para o serviço funcionar usamos prestadores (subcontratantes), que só
          tratam dados segundo as nossas instruções:
        </p>
        <ul>
          <li>
            <b>Supabase</b>: base de dados, autenticação e ficheiros. Os dados
            ficam na União Europeia (Irlanda).
          </li>
          <li>
            <b>Vercel</b>: alojamento da app.
          </li>
          <li>
            <b>Resend</b>: envio de emails (códigos de entrada, convites e
            lembretes).
          </li>
          <li>
            <b>Sentry</b>: deteção de erros técnicos da app (o que falhou e em
            que ecrã). Não recebe emails, nomes, notas nem o conteúdo dos teus
            registos, e os dados ficam na União Europeia (Alemanha).
          </li>
          <li>
            <b>Apple e Google</b>: entrega das notificações push no teu
            telemóvel, se as ativares. Recebem o conteúdo da notificação.
          </li>
        </ul>
        <p>
          Alguns destes prestadores podem tratar dados fora do Espaço Económico
          Europeu; quando acontece, é com as garantias previstas no RGPD (por
          exemplo, cláusulas contratuais-tipo).
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          Usamos apenas cookies estritamente necessários, para manter a tua
          sessão iniciada. Não usamos cookies de publicidade nem de análise de
          comportamento, por isso não pedimos consentimento para cookies.
        </p>
      </Section>

      <Section title="Quanto tempo guardamos">
        <p>
          Guardamos os dados enquanto a tua conta existir. Se apagares a conta,
          apagamos os teus dados pessoais. Por agora não fazemos cópias de
          segurança próprias, por isso não ficam cópias dos teus dados noutro
          lado (isto significa também que, se houver uma falha grave no nosso
          prestador, não conseguimos recuperar os dados). Os animais de que és o
          único dono são apagados com a conta, com todo o historial e ficheiros
          (ou transferes a posse a outra pessoa antes). Nos animais que
          continuam, porque outras pessoas cuidam deles, o que registaste e os
          documentos que carregaste ficam como parte do historial do animal, mas
          sem o teu nome: passam a aparecer como «Conta apagada». Os convites
          que enviaste e os dirigidos ao teu email são apagados, e os que
          ficarem por aceitar caducam.
        </p>
      </Section>

      <Section title="Os teus direitos">
        <p>Ao abrigo do RGPD, tens direito a:</p>
        <ul>
          <li>
            <b>Acesso e portabilidade:</b> exportar todos os teus dados e
            documentos em «Perfil → Exportar os meus dados».
          </li>
          <li>
            <b>Apagamento:</b> apagar a conta em «Perfil → Apagar conta».
          </li>
          <li>
            <b>Retificação:</b> corrigir o teu nome e os dados dos animais
            diretamente na app.
          </li>
          <li>
            <b>Oposição e limitação:</b> escreve-nos para{" "}
            <a href="mailto:patudos@miguelgazela.com">
              patudos@miguelgazela.com
            </a>
            .
          </li>
          <li>
            <b>Reclamação:</b> podes queixar-te à Comissão Nacional de Proteção
            de Dados (
            <a href="https://www.cnpd.pt" rel="noopener noreferrer">
              cnpd.pt
            </a>
            ).
          </li>
        </ul>
      </Section>

      <Section title="Segurança">
        <p>
          Os dados circulam cifrados (HTTPS). Cada animal só é acessível aos
          seus membros e os ficheiros ficam num espaço privado.
        </p>
      </Section>

      <Section title="Alterações">
        <p>
          Se esta política mudar de forma relevante, avisamos-te na app ou por
          email. Os <Link href="/termos">Termos de utilização</Link> também se
          aplicam.
        </p>
      </Section>
    </LegalPage>
  );
}
