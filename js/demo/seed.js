// Démonstration : parents, frères et sœurs de la famille ; le reste (oncles, cousins, documents) est inventé.
export const SEED = {
  members: [
    { id: 1, first_name: "Ahmed", last_name: "Said", sex: "M", birth_date: "1938-03-02", birth_place: "Mamoudzou", death_date: "2019-06-11", deceased: true, notes: "Exemple inventé pour la démonstration." },
    { id: 2, first_name: "Fatima", last_name: "Said", sex: "F", birth_date: "1942-09-20", birth_place: "Sada", notes: "Exemple inventé pour la démonstration." },
    { id: 3, first_name: "Ibrahim", last_name: "Said", sex: "M", father_id: 1, mother_id: 2, city: "Moroni", job: "Commerçant", phone: "+269 300 00 00", private_fields: ["phone", "email"] },
    { id: 4, first_name: "Nayma", last_name: "Said", sex: "F", father_id: 19, mother_id: 20 },
    { id: 5, first_name: "Samira", last_name: "Durand", birth_name: "Said", sex: "F", birth_date: "1970-07-08", father_id: 1, mother_id: 2 },
    { id: 6, first_name: "Marc", last_name: "Durand", sex: "M", birth_date: "1969-11-30" },
    { id: 7, first_name: "Youssef", last_name: "Said", sex: "M", birth_date: "1975-02-21", father_id: 1, mother_id: 2 },
    { id: 8, first_name: "Ambdouloih", last_name: "Said", sex: "M", father_id: 3, mother_id: 4 },
    { id: 9, first_name: "Ambdoulhafour", last_name: "Said", sex: "M", father_id: 3, mother_id: 4, city: "Doha", phone: "+974 5000 0000", email: "exemple@miff.demo", private_fields: ["phone", "email"] },
    { id: 10, first_name: "Youssrine", last_name: "Said", sex: "F", father_id: 3, mother_id: 4 },
    { id: 11, first_name: "Youssra", last_name: "Said", sex: "F", father_id: 3, mother_id: 4, city: "Marseille", job: "Infirmière", phone: "06 00 00 00 00", email: "youssra@miff.demo", notes: "Toujours partante pour les repas de famille.", private_fields: ["email"] },
    { id: 12, first_name: "Youmna", last_name: "Said", sex: "F", father_id: 3, mother_id: 4 },
    { id: 13, first_name: "Alhadad", last_name: "Said", sex: "M", father_id: 3, mother_id: 4 },
    { id: 14, first_name: "Assad", last_name: "Said", sex: "M", father_id: 3, mother_id: 4 },
    { id: 15, first_name: "Mogni", last_name: "Said", sex: "M", father_id: 3, mother_id: 4 },
    { id: 16, first_name: "Yankoub", last_name: "Said", sex: "M", father_id: 3, mother_id: 4 },
    { id: 17, first_name: "Abder", last_name: "Said", sex: "M", father_id: 3, mother_id: 4 },
    { id: 18, first_name: "Said", last_name: "Said", sex: "M", father_id: 3, mother_id: 4 },
    { id: 19, first_name: "Omar", last_name: "Haddad", sex: "M", birth_date: "1940-02-11", birth_place: "Dzaoudzi" },
    { id: 20, first_name: "Zaynab", last_name: "Haddad", sex: "F", birth_date: "1944-08-30" },
    { id: 21, first_name: "Bilal", last_name: "Haddad", sex: "M", birth_date: "1971-09-05", father_id: 19, mother_id: 20 },
    { id: 22, first_name: "Inès", last_name: "Durand", sex: "F", birth_date: "1997-12-05", father_id: 6, mother_id: 5 },
    { id: 23, first_name: "Hugo", last_name: "Durand", sex: "M", birth_date: "2001-03-27", father_id: 6, mother_id: 5 },
    { id: 24, first_name: "Salma", last_name: "Said", birth_name: "Ali", sex: "F", birth_date: "1978-06-12" },
    { id: 25, first_name: "Rayan", last_name: "Said", sex: "M", birth_date: "2006-01-09", father_id: 7, mother_id: 24 },
    { id: 26, first_name: "Maya", last_name: "Said", sex: "F", birth_date: "2010-04-22", father_id: 7, mother_id: 24 },
    { id: 27, first_name: "Sophie", last_name: "Haddad", birth_name: "Martin", sex: "F", birth_date: "1973-12-01" },
    { id: 28, first_name: "Noé", last_name: "Haddad", sex: "M", birth_date: "2003-07-17", father_id: 21, mother_id: 27 },
    { id: 29, first_name: "Léa", last_name: "Haddad", sex: "F", birth_date: "2007-02-03", father_id: 21, mother_id: 27 },
    { id: 30, first_name: "Thomas", last_name: "Leroy", sex: "M", birth_date: "1995-03-18" },
    { id: 32, first_name: "Nadia", last_name: "Said", birth_name: "Mze", sex: "F", birth_date: "1994-05-02", notes: "Exemple inventé pour la démonstration." },
    { id: 33, first_name: "Ilyes", last_name: "Said", sex: "M", birth_date: "2019-10-08", father_id: 8, mother_id: 32 },
    { id: 34, first_name: "Sara", last_name: "Said", sex: "F", birth_date: "2022-03-15", father_id: 8, mother_id: 32 },
    { id: 31, first_name: "Aya", last_name: "Leroy", sex: "F", birth_date: "2026-09-14", birth_place: "Mamoudzou", father_id: 30, mother_id: 22 },
  ],
  unions: [[1, 2], [3, 4], [5, 6], [7, 24], [19, 20], [21, 27], [22, 30], [8, 32]],
  users: [
    { member_id: 9, username: "ambdoulhafour", password: "demo1234", is_admin: true },
    { member_id: 11, username: "youssra", password: "demo1234", is_admin: false },
    { member_id: 22, username: "ines", password: "demo1234", is_admin: false },
    { member_id: 3, username: "ibrahim", password: "demo1234", is_admin: false },
  ],
  // Messages du chat (minutes avant maintenant).
  messages: [
    { chat: "fam", from: 3, ago: 4320, text: "Salam à tous ! Pensez à scanner vos actes de naissance, on en aura besoin pour le dossier de grand-mère." },
    { chat: "fam", from: 22, ago: 3000, kind: "birth", member: 31, text: "Aya est née le 14 septembre à Mamoudzou. La maman et le bébé vont bien !" },
    { chat: "fam", from: 11, ago: 2950, text: "Félicitations Inès et Thomas ! 🎉" },
    { chat: "fam", from: 3, ago: 2900, text: "Mabrouk ! Qu'Allah la protège." },
    { chat: "dm:9-11", from: 11, ago: 600, text: "Ambdoulhafour, tu peux mettre le livret de famille dans l'appli ? Je n'arrive pas à le retrouver." },
    { chat: "fam", from: 22, ago: 180, text: "On fait un repas chez mamie Fatima dimanche ?" },
    { chat: "dm:3-9", from: 3, ago: 1500, text: "Pense à scanner ta carte d'identité avant ton voyage." },
  ],
  // Demandes d'accès en attente.
  requests: [{ doc: 2, from: 22, reason: "Je prépare mon dossier pour une prépa, je voudrais voir comment tu avais présenté tes notes.", duration: "7d", ago: 90 }],
  docs: [
    { owner: 1, person: 9, folder: "actes-naissance", page: "acteYanis", type: "acte_naissance", title: "Acte de naissance – Ambdoulhafour", year: "1995", visibility: "family", created: "2026-11-02 10:12:00",
      fields: { date_naissance: { label: "Date de naissance", value: "14/05/1995" }, lieu_naissance: { label: "Lieu de naissance", value: "Mamoudzou" }, parents: { label: "Parents", value: "Ibrahim Said et Nayma Said" } } },
    { owner: 1, person: 9, folder: "lycee", page: "bulletinYanis", type: "bulletin", title: "Bulletin Terminale S – 2e trimestre 2012-2013 – Ambdoulhafour", year: "2012", visibility: "custom", targets: ["rel:parents"], created: "2026-11-05 18:40:00",
      fields: { etablissement: { label: "Établissement", value: "Lycée Younoussa-Bamana, Mamoudzou" }, classe: { label: "Classe", value: "Terminale S" }, annee_scolaire: { label: "Année scolaire", value: "2012-2013" }, trimestre: { label: "Trimestre", value: "2e trimestre" }, moyenne: { label: "Moyenne générale", value: "13,42" } } },
    { owner: 1, person: 9, folder: "cni", page: "cniYanis", type: "cni", title: "Carte d'identité – Ambdoulhafour", year: "2021", visibility: "private", created: "2026-11-06 09:00:00",
      fields: { expiration: { label: "Date d'expiration", value: "03/02/2031" } } },
    { owner: 2, person: 11, folder: "actes-naissance", page: "acteLina", type: "acte_naissance", title: "Acte de naissance – Youssra", year: "1998", visibility: "custom", targets: ["rel:siblings", "rel:parents"], created: "2026-11-08 14:20:00",
      fields: { date_naissance: { label: "Date de naissance", value: "02/10/1998" }, lieu_naissance: { label: "Lieu de naissance", value: "Mamoudzou" } } },
    { owner: 2, person: 11, folder: "quittances", page: "quittanceLina", type: "quittance", title: "Quittance de loyer – octobre 2026", year: "2026", visibility: "private", created: "2026-11-09 08:00:00" },
    { owner: 3, person: 22, folder: "college", page: "bulletinInes", type: "bulletin", title: "Bulletin 4e B – 1er trimestre 2010-2011 – Inès", year: "2010", visibility: "custom", targets: ["rel:parents"], created: "2026-11-10 20:05:00",
      fields: { etablissement: { label: "Établissement", value: "Collège de Kawéni" }, classe: { label: "Classe", value: "4e B" }, annee_scolaire: { label: "Année scolaire", value: "2010-2011" }, trimestre: { label: "Trimestre", value: "1er trimestre" } } },
    { owner: 4, person: 1, folder: "actes-deces", page: "decesAhmed", type: "acte_deces", title: "Acte de décès – Ahmed", year: "2019", visibility: "family", created: "2026-11-12 11:30:00",
      fields: { date: { label: "Date", value: "11/06/2019" } } },
    { owner: 4, person: 1, folder: "succession", page: "succession", type: "succession", title: "Succession de grand-père – acte de notoriété", year: "2019", visibility: "custom", targets: ["rel:siblings"], created: "2026-11-12 11:45:00" },
  ],
};

function page(lines, { w = 1240, h = 1754, bg = "#fffef9", border = null } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (border) { x.strokeStyle = border; x.lineWidth = 6; x.strokeRect(24, 24, w - 48, h - 48); }
  let y = 120;
  for (const l of lines) {
    if (l === "") { y += 30; continue; }
    const [txt, size = 30, weight = "400", align = "left"] = Array.isArray(l) ? l : [l];
    x.font = `${weight} ${size}px system-ui, -apple-system, Arial, sans-serif`;
    x.fillStyle = "#1b1b1b";
    x.textAlign = align;
    x.fillText(txt, align === "center" ? w / 2 : 100, y);
    y += size + 26;
  }
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
}

const acte = (nom, sexe, date, mot, lieu, parents) => page([
  ["RÉPUBLIQUE FRANÇAISE", 30, "700", "center"], ["Mairie de Mamoudzou – Mayotte", 28, "400", "center"], "",
  ["EXTRAIT D'ACTE DE NAISSANCE", 44, "800", "center"], "", "",
  `${nom}, de sexe ${sexe},`, `${mot} le ${date} à ${lieu}`, parents, "", "",
  ["Délivré à Mamoudzou, le 3 novembre 2026", 26], ["L'officier de l'état civil", 26],
], { border: "#1f6a4b" });

export async function makeSeedPages() {
  return {
    acteYanis: [await acte("Ambdoulhafour SAID", "masculin", "14 mai 1995", "né", "Mamoudzou (Mayotte)", "fils d'Ibrahim SAID et de Nayma SAID")],
    acteLina: [await acte("Youssra SAID", "féminin", "2 octobre 1998", "née", "Mamoudzou (Mayotte)", "fille d'Ibrahim SAID et de Nayma SAID")],
    bulletinYanis: [await page([
      ["LYCÉE YOUNOUSSA-BAMANA – MAMOUDZOU", 36, "800"], ["BULLETIN DU 2e TRIMESTRE", 40, "700"], ["Année scolaire 2012-2013", 30], "",
      ["Élève : SAID Ambdoulhafour        Classe : Terminale S", 30, "600"], "",
      "Mathématiques                  14,50", "Physique-Chimie               12,00", "SVT                                  13,75", "Philosophie                      11,25", "Anglais                            15,00", "",
      ["Moyenne générale : 13,42", 34, "700"], ["Appréciation du conseil de classe : bon trimestre, continuez.", 26],
    ])],
    bulletinInes: [await page([
      ["COLLÈGE DE KAWÉNI", 36, "800"], ["Bulletin trimestriel – 1er trimestre – 2010/2011", 32, "700"], "",
      ["Nom : DURAND Inès        Classe : 4ème B", 30, "600"], "",
      "Français                 12,50", "Mathématiques       15,00", "Histoire-Géo           13,00", "",
      ["Moyenne générale de l'élève : 13,10", 32, "700"],
    ])],
    cniYanis: [await page([
      ["RÉPUBLIQUE FRANÇAISE", 30, "700"], ["CARTE NATIONALE D'IDENTITÉ", 34, "800"], "",
      "Nom : SAID", "Prénom : Ambdoulhafour", "Né le : 14/05/1995 à Mamoudzou", "Date d'expiration : 03/02/2031",
    ], { w: 1000, h: 630, bg: "#e8f1f7", border: "#6b8fb0" })],
    quittanceLina: [await page([
      ["QUITTANCE DE LOYER", 42, "800", "center"], ["Octobre 2026", 30, "400", "center"], "", "",
      "Locataire : Youssra SAID", "Logement : 12 rue du Lagon, Mamoudzou", "", "Loyer : 650,00 €", "Charges : 40,00 €", ["Total payé : 690,00 €", 32, "700"], "", "Le bailleur, M. Ali",
    ])],
    decesAhmed: [await page([
      ["RÉPUBLIQUE FRANÇAISE", 30, "700", "center"], ["Mairie de Mamoudzou – Mayotte", 28, "400", "center"], "",
      ["EXTRAIT D'ACTE DE DÉCÈS", 44, "800", "center"], "", "",
      "Le 11 juin 2019 est décédé à Mamoudzou", "Ahmed SAID, né le 2 mars 1938 à Mamoudzou,", "époux de Fatima SAID.",
    ], { border: "#55606a" })],
    succession: [
      await page([["ÉTUDE NOTARIALE DE MAMOUDZOU", 34, "800"], "", ["ACTE DE NOTORIÉTÉ", 42, "800"], ["Succession de M. Ahmed SAID", 32, "600"], "", "Héritiers :", "– Mme Fatima SAID, conjointe survivante", "– M. Ibrahim SAID, fils", "– Mme Samira DURAND, fille", "– M. Youssef SAID, fils", "", ["Page 1/2", 24]]),
      await page([["ÉTUDE NOTARIALE DE MAMOUDZOU", 34, "800"], "", "Biens : maison familiale de Cavani,", "terrain agricole à Sada.", "", "Fait à Mamoudzou, le 4 septembre 2019.", "", ["Page 2/2", 24]]),
    ],
  };
}
