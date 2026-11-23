import type { Metadata } from "next";
import Link from "next/link";

import { Confirmar, LegalPage, Section } from "@/components/publico/legal";

export const metadata: Metadata = {
  title: "Termos de utilização · Patudos",
  description:
    "As regras simples para usar o Patudos, a app para gerir a vida dos teus animais de estimação.",
  robots: { index: true, follow: true },
};

// Ecrã 34 (termos). Página pública e estática. Rascunho: ver os marcadores [A CONFIRMAR].
export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de utilização"
      other={{ href: "/privacidade", label: "Ler a Política de privacidade" }}
    >
      <p className="text-tinta-suave">
        Última atualização: <Confirmar>data</Confirmar>
      </p>

      <Section title="O que é o Patudos">
        <p>
          O Patudos é uma app para registares a saúde, os lembretes, as despesas
          e os documentos dos teus cães e gatos, e para os partilhares com quem
          cuida deles. O serviço é prestado por{" "}
          <Confirmar>nome ou entidade responsável</Confirmar>.
        </p>
      </Section>

      <Section title="A tua conta">
        <ul>
          <li>
            Entras com o teu email e um código de 6 dígitos que enviamos para
            lá. Não há palavra-passe.
          </li>
          <li>
            Tens de ter acesso ao email que usas. Quem tiver acesso ao teu email
            consegue entrar na tua conta, por isso protege-o.
          </li>
          <li>
            Dás-nos o teu nome verdadeiro ou o que preferires: é o que os outros
            veem em «registado por…».
          </li>
        </ul>
      </Section>

      <Section title="O que podes fazer">
        <ul>
          <li>
            Registar informação sobre os teus animais e anexar fotos e
            documentos que te pertençam ou que tenhas o direito de guardar.
          </li>
          <li>
            Convidar outras pessoas para cuidarem de um animal. Quem convidas vê
            os registos desse animal; tu decides quem convidas e podes retirar o
            acesso quando quiseres.
          </li>
          <li>
            Não podes usar a app para fins ilegais, nem tentar aceder a dados de
            animais ou pessoas que não te foram partilhados.
          </li>
        </ul>
      </Section>

      <Section title="Os teus dados">
        <p>
          O que registas continua a ser teu. Tratamos os dados só para prestar o
          serviço, como explica a{" "}
          <Link href="/privacidade">Política de privacidade</Link>. Podes
          exportar os teus dados e apagar a conta quando quiseres (em «Perfil»).
        </p>
      </Section>

      <Section title="Não substitui o veterinário">
        <p>
          O Patudos é um caderno e um lembrete. Não dá conselhos de saúde nem
          diagnósticos. Em caso de dúvida ou urgência, fala com o teu
          veterinário. Os lembretes ajudam, mas podem falhar (por exemplo, sem
          rede ou com as notificações desligadas), por isso confirma sempre as
          datas importantes.
        </p>
      </Section>

      <Section title="Disponibilidade e alterações">
        <ul>
          <li>
            Fazemos o possível para o serviço estar sempre disponível, mas não
            garantimos que nunca tenha falhas ou paragens.
          </li>
          <li>
            Podemos melhorar ou alterar a app. Se estes termos mudarem de forma
            relevante, avisamos-te na app ou por email.
          </li>
          <li>Podemos suspender contas que usem o serviço de forma abusiva.</li>
        </ul>
      </Section>

      <Section title="Responsabilidade">
        <p>
          O serviço é prestado «como está». Na medida permitida pela lei, não
          respondemos por danos resultantes de falhas, perdas de dados ou
          lembretes que não cheguem a tempo. Isto não limita os direitos que a
          lei te dá como consumidor.
        </p>
      </Section>

      <Section title="Lei aplicável e contacto">
        <p>
          Aplica-se a lei portuguesa. Para qualquer questão, escreve para{" "}
          <Confirmar>email de contacto</Confirmar>.
        </p>
      </Section>
    </LegalPage>
  );
}
