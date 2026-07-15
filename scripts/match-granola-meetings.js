#!/usr/bin/env node
/**
 * Match Granola meetings to Supabase clients by participant email.
 * Outputs matched meetings to stdout as JSON.
 *
 * Usage: node scripts/match-granola-meetings.js > scripts/matched-meetings.json
 */

// Client data from Supabase (id, name, email)
const clients = [
  { id: "97e42d8f-529e-47cf-9759-eb44562d3ed5", name: "Karla Scholten", email: "karla.scholten@aloyoga.com" },
  { id: "4f565e58-56eb-4227-b7bd-c9d463a3174b", name: "Anshul Bhagi", email: "anshul@turing.com" },
  { id: "a1f44951-01c8-4c87-af71-2edbf3695c3e", name: "Andrei Georgescu", email: "ageorgescu@vivodyne.com" },
  { id: "1ce79b6f-9e57-4685-8823-10b77bbb0a2a", name: "Mateusz Malinowski", email: "mateusz@moonvalley.ai" },
  { id: "15f7a140-c6f6-4ca8-80e0-fcd4209d2c14", name: "Richard Price", email: "richard@academia.edu" },
  { id: "7de5d0ba-09f7-46e6-bf90-e9d9a6365187", name: "Fitz Tepper", email: "fitz@cardless.com" },
  { id: "cf09405c-dbc0-4e04-8569-b7bac51f6ec6", name: "Karen Peters", email: "karen.peters@aloyoga.com" },
  { id: "7e4be6e7-4c69-460d-89b0-61c3c0621e16", name: "Summer", email: "summer@aloyoga.com" },
  { id: "e00acb71-c4e2-4694-b7cc-c03f440b3ccd", name: "Lauren Lamanske", email: "lauren.lamanske@aloyoga.com" },
  { id: "38d66914-0d44-4046-8f1e-332b8093bec1", name: "Nadia Koritareva", email: "nadia@angellist.com" },
  { id: "dde499a9-683b-4af2-9013-57aa4e4353fc", name: "Tom Mazur", email: "tom.mazur@wincent.co" },
  { id: "a84c171c-5aa1-4402-ae85-738f749f6075", name: "AngelList Manager Training", email: "elisa.dimauro@angellist.com" },
  { id: "e6e77954-6ea4-4fcd-82db-5f2214a8e6f0", name: "Christina Engebretson", email: "christina.engebretson@flocksafety.com" },
  { id: "5b551095-9d30-4ab1-944f-66de6ea0e535", name: "Will Yin", email: "will@mandolin.com" },
  { id: "2e5a92c9-fb6e-4c3a-bd19-cbeef594933f", name: "Ceci Stallsmith", email: "ceci@lovable.dev" },
  { id: "b1610a99-72fe-469a-af93-0efa964ea3dd", name: "Fabian Hedin", email: "fabian@lovable.dev" },
  { id: "e13010ff-f82a-4c5c-b315-407f15407469", name: "Paul Tyger", email: "paul.tyger@charliehealth.com" },
  { id: "409c3cac-b62a-4630-be6f-3f5c98ee888c", name: "Alex Pesant", email: "alex@lovable.dev" },
  { id: "cf79056c-4374-481e-9b5e-fde0ea4e40f1", name: "Chris McClellan", email: "chris.mcclellan@charliehealth.com" },
  { id: "67f922ae-6e08-4af7-932c-be89d221950e", name: "Ryan Meadows", email: "ryan@lovable.dev" },
  { id: "65bd9783-70b8-4476-a24c-cf4c83b1d43b", name: "Ed Ulbrich", email: "ed@moonvalley.com" },
  { id: "4fbc328a-005b-4543-a2f5-db5bccf7cbc6", name: "Caroline Wong", email: "caroline@lovable.dev" },
  { id: "405b8ba6-b7d3-4e2f-882e-0870d35b1bf1", name: "Scott Miller", email: "scott.miller@aloyoga.com" },
  { id: "65bc281d-034f-4318-a028-0deed0c43991", name: "Erica Brescia", email: "ebrescia@redpoint.com" },
  { id: "eac090bc-5146-4e8c-8c49-9b6a89480002", name: "Kim Lewandowski", email: "kim@chainguard.dev" },
  { id: "53950687-96f1-432b-94dd-7e6665e20c8b", name: "Eli Muhrer", email: "eli.muhrer@charliehealth.com" },
  { id: "a6fc0a34-cc1f-476e-acaf-ed28989f75c6", name: "Bryn Mooser", email: "bryn@xtr.com" },
  { id: "75caa18a-f121-4b57-b422-03efd0f5cb29", name: "Tomas Malik", email: "tomas.malik@wincent.co" },
  { id: "8575087b-325b-4ca6-8dc3-70e51f08f697", name: "Carter Barnhart", email: "carter@charliehealth.com" },
  { id: "e27e20f3-7978-4a74-a0b5-b18c75ef3a32", name: "Andrew Maher", email: "andrew@moonvalley.com" },
  { id: "a8181d04-4442-48ae-af4f-bbc38234346f", name: "Sarah Charlton", email: "chuck@moonvalley.com" },
  { id: "070b3911-d31c-496a-acce-ccf05d1be21f", name: "Alex Latraverse", email: "lat@flocksafety.com" },
  { id: "ff47a392-ff33-4ac2-85ab-2beb79ad7bf3", name: "Nishad Acharya", email: "nishad@turing.com" },
  { id: "a6fda188-dd3f-4633-90f3-c628595aba42", name: "Anastasia Kaschenko", email: "anastasia@v7labs.com" },
  { id: "20162365-fe72-4413-b96a-234c813c5778", name: "Alex Pearson", email: "alex.pearson@charliehealth.com" },
  { id: "b942b7a0-e180-480e-8fcd-13ab87a9370e", name: "James Raybould", email: "james@turing.com" },
  { id: "1231fac0-70b8-4dc2-8e17-c56870599f0c", name: "Sam Reider", email: "sam.reider@charliehealth.com" },
  { id: "680ca4a4-22b5-4156-b35d-8f09d65ebd62", name: "John Thomas", email: "john@moonvalley.com" },
  { id: "6d8c5c6a-be74-4fd1-8c56-070d9c9430d7", name: "Mik Binkowski", email: "mik@moonvalley.ai" },
  { id: "9868338a-1a9c-47a4-80af-c0ed97e6a59d", name: "Vignesh Kalimuthu", email: "viky@v7labs.com" },
  { id: "fbe063a8-d2c5-46ad-82db-2ac7031975f6", name: "Christine Ko", email: "christine.ko@charliehealth.com" },
  { id: "8e7e92be-6ab3-4065-b967-3e1ef4133f74", name: "Clark Dewoskin", email: "clark.dewoskin@charliehealth.com" },
  { id: "3da089c8-5a93-470d-b550-dbf621a79943", name: "Rohit Rustagi", email: "rohit@mandolin.com" },
  { id: "71b5de80-3fe8-4247-a629-93e1c57dad39", name: "Chris Warnock", email: "chris.w@v7labs.com" },
  { id: "2adea35e-3519-4007-aba4-d5c8dcc8868a", name: "Caroline Fenkel", email: "caroline@charliehealth.com" },
  { id: "c81930c1-bab8-4218-8083-23aa8b352cbb", name: "Andrea Azzini", email: "andrea@v7labs.com" },
  { id: "67faaa01-7aff-489e-ad50-6af579153908", name: "Rich Rines", email: "rich@coredao.org" },
  { id: "89607787-9c6b-4362-a0d2-26054ddaaa25", name: "Simon Edwardsson", email: "simon@v7labs.com" },
  { id: "22f971ae-b9a3-48be-a96e-5f1258c2b934", name: "Sam O'Driscoll", email: "sam.odriscoll@angellist.com" },
  { id: "621dc627-247c-4264-9cf5-5128f68777d1", name: "Jessie Barry", email: "jb794@cornell.edu" },
  { id: "27c6f8f8-1ed2-4f69-999a-2026d99dc283", name: "Nathan Sobo", email: "nathan@zed.dev" },
  { id: "eece0753-900d-44a8-94b8-d11d9a1fb900", name: "Davis Lukens", email: "davis.lukens@flocksafety.com" },
  { id: "25d0d464-d57c-44fc-8b52-fb4363cddaae", name: "Becca Arneson", email: "becca.arneson@aloyoga.com" },
  { id: "9231d9ba-8ed0-4948-9569-08eff2ad50c4", name: "Meg Heusel", email: "meg@flocksafety.com" },
  { id: "40236a6f-f232-40bf-a153-0699e8ab911c", name: "Samuel Hapak", email: "samuel@wincent.co" },
];

// Build email-to-client lookup (lowercase)
const emailToClient = {};
for (const c of clients) {
  emailToClient[c.email.toLowerCase()] = { id: c.id, name: c.name, email: c.email };
}

// All Granola meetings (combined from both time ranges)
const meetings = [
  // === Range 1: Nov 26 2025 - Jan 23 2026 ===
  { id: "5e27b53a-d5a0-4b08-b645-a8faf188470b", title: "Richard <> Adam coaching", date: "2026-01-23T23:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Richard Price from Academia <richard@academia.edu>, Academia-1-Ashtadhyayi (200) <c_18829prcmjppmhsenfi49tvdk6fse@resource.calendar.google.com>" },
  { id: "59232438-c6e3-4827-9e27-b59fc4a24358", title: "Erica (Redpoint) and Adam Donkin", date: "2026-01-23T21:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Erica Brescia from poolside <ebrescia@redpoint.com>" },
  { id: "39033437-640e-430d-b2cc-b24b7eaa459a", title: "Caroline<>Adam 1-1 coaching", date: "2026-01-23T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Caroline Wong from Lovable <caroline@lovable.dev>, Emma Giles from Mocharymethod <emma@mocharymethod.com>" },
  { id: "aa7e771a-8c5c-48bc-898d-4a7f04308283", title: "Will/Adam", date: "2026-01-22T20:20:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Will from Mandolin <will@mandolin.com>" },
  { id: "c750b6c1-07cf-46c8-ac5d-fe5f4de5255d", title: "Christina/Adam", date: "2026-01-22T20:04:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Christina Engebretson from Flocksafety <christina.engebretson@flocksafety.com>" },
  { id: "eea370c4-ea1c-4d71-beb1-8962fd938686", title: "Nathan <> Adam 1-1 coaching", date: "2026-01-21T21:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Nathan Sobo from Zed <nathan@zed.dev>" },
  { id: "9ca17b11-398f-4b69-afbf-7f11a5585115", title: "Adam <> Alex coaching", date: "2026-01-21T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Alexandre from Lovable <alex@lovable.dev>" },
  { id: "cc7ae107-0298-40da-98ea-5c5ff25a226d", title: "Fitz <> Adam 1-1 coaching", date: "2026-01-19T19:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Fitz from Cardless <fitz@cardless.com>" },
  { id: "7fa1c0e8-60f2-4d7e-becc-c22ec4e07d66", title: "Richard <> Adam coaching", date: "2026-01-16T23:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Richard Price from Academia <richard@academia.edu>, Academia-1-Ashtadhyayi (200) <c_18829prcmjppmhsenfi49tvdk6fse@resource.calendar.google.com>" },
  { id: "4a6827d3-f75e-4422-8572-6df338d53ca7", title: "Nadia<>Adam 1-1 coaching", date: "2026-01-16T19:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Nadia Koritareva from AngelList <nadia@angellist.com>" },
  { id: "c9ea4892-4ad8-465a-bf36-666bb906386c", title: "Fabian<>Adam 1:1 coaching (session 1)", date: "2026-01-16T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Fabian Hedin from Lovable <fabian@lovable.dev>, Jesper Lekland from Lovable <jesper@lovable.dev>" },
  { id: "5d5f0462-ce1c-4338-96f3-895da89af7a2", title: "Tom <> Adam coaching hold", date: "2026-01-16T00:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Tom Mazur <tom.mazur@wincent.co>, Miro Skovajsa <miro.skovajsa@wincent.co>" },
  { id: "b23aa4ed-6e9a-4e8f-aa93-e091b51787c3", title: "Ceci Stallsmith and Adam Donkin", date: "2026-01-15T21:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Ceci from Lovable <ceci@lovable.dev>" },
  { id: "5720d055-1380-44c4-8c06-aaba25d1116e", title: "Simon <> Adam 1-1 coaching", date: "2026-01-15T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Simon Edwardsson from V7labs <simon@v7labs.com>" },
  { id: "632e1d13-04dd-4b0f-a98a-7c0990da45e7", title: "Christina <> Adam 1-1 coaching", date: "2026-01-14T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Christina Engebretson from Flocksafety <christina.engebretson@flocksafety.com>" },
  { id: "25d216f2-3ffa-4e7b-a1d8-59319fe279d6", title: "Will <> Adam 1-1 coaching", date: "2026-01-14T00:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Will from Mandolin <will@mandolin.com>" },
  { id: "514316c2-1c4c-43f0-beea-40336dc419a2", title: "Fitz <> Adam 1-1 coaching", date: "2026-01-07T23:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Fitz from Cardless <fitz@cardless.com>" },
  { id: "9b8368a9-f2f3-4517-85ac-b8ac8eb1a507", title: "Adam <> Alex coaching", date: "2026-01-07T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Alexandre from Lovable <alex@lovable.dev>" },
  { id: "156137da-8a88-44d7-aa06-1664f3ca1261", title: "Caroline <> Adam coaching", date: "2026-01-06T16:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Caroline <caroline@lovable.dev>" },
  { id: "58cbd55e-3fdf-44cd-8a76-e03d2a140029", title: "Will/Adam 1-1 coaching", date: "2026-01-06T00:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Will from Mandolin <will@mandolin.com>" },
  { id: "6ef296a2-921d-4197-83fc-64518bb8388e", title: "Richard <> Adam coaching", date: "2026-01-09T23:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Richard Price from Academia <richard@academia.edu>, Academia-1-Ashtadhyayi (200) <c_18829prcmjppmhsenfi49tvdk6fse@resource.calendar.google.com>" },
  { id: "b6ab9b08-0fa7-41be-b973-f3218ffbe1b4", title: "Kim <> Adam coaching", date: "2026-01-09T22:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Kim from Chainguard <kim@chainguard.dev>" },
  { id: "67f499ae-19fa-497c-9040-18db21444641", title: "Becca/Adam coaching", date: "2026-01-09T19:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Becca Arneson from Alo Yoga <becca.arneson@aloyoga.com>, Max Mauser <max.mauser@aloyoga.com>" },
  { id: "8383f779-1076-4bd8-9bb9-2fd331a6cf65", title: "Carter/Adam 1:1", date: "2026-01-09T17:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, R. Dakota Carter, MD, Ed.D from Eisenhower Health <carter@charliehealth.com>" },
  { id: "bc5f6343-ddfe-49ec-97c6-3c6dda5b8cba", title: "Meg <> Adam 1-1 coaching", date: "2026-01-08T20:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Meg from Flocksafety <meg@flocksafety.com>" },
  { id: "7cb890d6-4321-4b1f-b173-d13e7f61f4dd", title: "Davis <> Adam 1-1 coaching", date: "2026-01-08T18:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Davis Lukens from Flocksafety <davis.lukens@flocksafety.com>" },
  { id: "f5693b67-00bd-4b5e-adbd-6d3e9266d88c", title: "Caroline and Adam Donkin", date: "2025-12-23T22:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Dr. Caroline Fenkel, LCSW from Charlie Health <caroline@charliehealth.com>" },
  { id: "e205fe47-468b-46b2-bd8e-3aae66f04c76", title: "Carter Barnhart and Adam Donkin", date: "2025-12-23T20:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, R. Dakota Carter, MD, Ed.D from Eisenhower Health <carter@charliehealth.com>" },
  { id: "2fb5f50e-c2c2-4a31-9bc0-d41c633e2ca9", title: "Mateusz<>Adam coaching", date: "2025-12-23T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Mateusz <mateusz@moonvalley.ai>" },
  { id: "007749bf-90d8-48fe-8f23-1f862a4cf609", title: "Coaching w/ Adam (Nathan Sobo)", date: "2025-12-22T18:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Nathan Sobo from Zed <nathan@zed.dev>" },
  { id: "cad680ad-a801-4424-8a87-7254b7aa833a", title: "Ceci <> Adam coaching", date: "2025-12-22T16:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Ceci from Lovable <ceci@lovable.dev>" },
  { id: "b20d2469-2920-4ef7-b4dd-65be560ada0e", title: "James <> Adam 1-1 coaching", date: "2025-12-19T23:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, James Raybould from Turing <james@turing.com>" },
  { id: "5388a0e2-a19f-480c-be7e-99d3a7eb899f", title: "Anshul Bhagi and Adam Donkin", date: "2025-12-19T22:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Anshul Bhagi from Turing <anshul.bhagi.c@turing.com>" },
  { id: "d4535fcf-a744-4a30-8dec-7f5a4ce0cc58", title: "Alex <> Adam coaching", date: "2025-12-19T17:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Alexandre from Lovable <alex@lovable.dev>" },
  { id: "e2c0e1a8-f123-45b4-9917-1c37998e6ed1", title: "Bryn mooser and Adam Donkin", date: "2025-12-18T22:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Bryn <bryn@asteriafilm.com>" },
  { id: "5d7b80c7-1e86-48ed-8fe5-115b00137f03", title: "Christina <> Adam 1-1 coaching", date: "2025-12-18T20:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Christina Engebretson from Flocksafety <christina.engebretson@flocksafety.com>" },
  { id: "3ad77983-3f20-4e33-b4ab-d7912a097c65", title: "Nadia <> Adam 1-1 coaching", date: "2025-12-18T18:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Nadia Koritareva from AngelList <nadia@angellist.com>" },
  { id: "2af34061-ef21-4052-854d-c47e16b9499a", title: "Andrea (V7) and Adam Donkin", date: "2025-12-18T17:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Andrea Azzini from V7 <andrea@v7labs.com>" },
  { id: "1fc0c1e8-b778-46f9-92f2-f87ad831fc68", title: "Eli <> Adam 1-1 coaching", date: "2025-12-17T21:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Eli Muhrer, MD from Charlie Health <eli.muhrer@charliehealth.com>" },
  { id: "2993f84c-f9c0-4c9a-9fd8-4d286192d828", title: "Coaching w/ Adam (Andrew Maher)", date: "2025-12-17T17:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Andrew Maher from Moonvalley <andrew@moonvalley.com>" },
  { id: "174a07f9-f441-4bac-a636-28baf7ec480d", title: "Mateusz <> Adam coaching", date: "2025-12-16T17:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Mateusz <mateusz@moonvalley.ai>" },
  { id: "b110390c-68fc-4f66-aaee-36fa0f7f20ea", title: "Will <> Adam 1-1 coaching", date: "2025-12-16T01:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Will from Mandolin <will@mandolin.com>" },
  { id: "86fba0bc-5c97-47d2-9295-a586d68adf12", title: "Coaching w/ Adam (Carter Barnhart)", date: "2025-12-15T21:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, R. Dakota Carter, MD, Ed.D from Eisenhower Health <carter@charliehealth.com>" },
  { id: "515620a2-1683-4a09-8461-3ee232ce6abe", title: "Sam Reider and Adam Donkin", date: "2025-12-12T22:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Sam Reider from Charliehealth <sam.reider@charliehealth.com>" },
  { id: "d0adf3a3-1734-45b2-92de-80bc883df83e", title: "alex + adam", date: "2025-12-12T22:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Alex Pearson from Charlie Health <alex.pearson@charliehealth.com>, Elizabeth Brissette <elizabeth.brissette@charliehealth.com>" },
  { id: "824c5956-7cd1-4eb7-ac02-ef839787b00d", title: "Chris <> Adam 1-1 coaching", date: "2025-12-12T21:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Chris Mcclellan <chris.mcclellan@charliehealth.com>" },
  { id: "9191c853-8b1c-449b-94e6-c865f4118fa4", title: "Tom <> Adam 1-1 coaching", date: "2025-12-12T00:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Miro Skovajsa <miro.skovajsa@wincent.co>, Tom Mazur <tom.mazur@wincent.co>" },
  { id: "2d648874-53f3-479f-926d-421a0d91148f", title: "Richard Price and Adam Donkin", date: "2025-12-11T00:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Richard Price from Academia <richard@academia.edu>, Academia-1-Ashtadhyayi (200) <c_18829prcmjppmhsenfi49tvdk6fse@resource.calendar.google.com>" },
  { id: "3ceabeb5-2121-4164-ab4d-32780240cfc4", title: "Kim <> Adam 1-1 coaching", date: "2025-12-10T22:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Kim from Chainguard <kim@chainguard.dev>" },
  { id: "e6de485a-25ce-41f0-83f9-0e2c24895c38", title: "Fitz/Adam 1-1 coaching", date: "2025-12-10T01:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Fitz from Cardless <fitz@cardless.com>" },
  { id: "15fd4518-c3e5-4331-9e35-8c624c75ca58", title: "Will <> Adam 1-1 coaching", date: "2025-12-09T01:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Will from Mandolin <will@mandolin.com>" },
  { id: "eb220536-e9fc-4c29-b56c-89b25da9bc81", title: "James <> Adam 1-1 coaching", date: "2025-12-08T22:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, James Raybould from Turing <james@turing.com>" },
  { id: "bf4e0fee-238c-4def-8183-fd2f5e675ed2", title: "Davis <> Adam 1-1 coaching", date: "2025-12-11T18:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Davis Lukens from Flocksafety <davis.lukens@flocksafety.com>" },
  { id: "d567c380-4b25-4af2-9db6-c3ca1fd787da", title: "Becca Arneson and Adam Donkin", date: "2025-12-05T22:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Becca Arneson from Alo Yoga <becca.arneson@aloyoga.com>" },
  { id: "aa3b8575-e4c4-4769-9336-5dfbbea823f8", title: "Meg <> Adam 1-1 coaching", date: "2025-12-05T19:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Meg from Flocksafety <meg@flocksafety.com>" },
  { id: "2d095211-9a2e-45ff-a656-488aea265f64", title: "Alex <> Adam exec coaching intro", date: "2025-12-05T16:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Alexandre from Lovable <alex@lovable.dev>" },
  { id: "1e1b12bf-69f4-4b2f-a0d3-7a07985a358f", title: "Nadia <> Adam 1-1 coaching", date: "2025-12-04T18:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Nadia Koritareva from AngelList <nadia@angellist.com>" },
  { id: "56c38352-15d7-486a-a024-03a0e8ce9cde", title: "Simon <> Adam 1-1 coaching", date: "2025-12-04T17:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Simon Edwardsson from V7labs <simon@v7labs.com>" },
  { id: "bc2dddd1-e73b-499e-aec8-b576ff967b3b", title: "Fitz / Adam 1:1 coaching", date: "2025-12-03T23:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Fitz from Cardless <fitz@cardless.com>" },
  { id: "95b1e748-253b-42ea-8d65-822da87e82b0", title: "Eli Muhrer and Adam Donkin", date: "2025-12-03T21:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Eli Muhrer <eli.muhrer@charliehealth.com>" },
  { id: "0ba93f80-f53c-41dd-857a-cd4be397017d", title: "Adam Donkin x Caroline Wong", date: "2025-12-03T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Caroline <caroline@lovable.dev>" },
  { id: "d0d39d7d-fc64-47e2-af55-42e5950fd8ca", title: "Mik <> Adam 1-1 coaching", date: "2025-12-03T01:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Mik <mik@moonvalley.ai>" },
  { id: "c065adf4-8f69-46c4-bbe1-7e2b55c4c153", title: "Christina <> Adam 1-1 coaching", date: "2025-12-02T22:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Christina Engebretson from Flocksafety <christina.engebretson@flocksafety.com>" },
  { id: "9da82a10-8c1c-4996-8638-a2f6e44c02dd", title: "Elisa and Adam Donkin", date: "2025-12-02T19:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Elisa Dimauro from Angellist <elisa.dimauro@angellist.com>" },
  { id: "46db71c3-43e2-48b8-9f8e-b4892f808a4b", title: "Will <> Adam 1-1 coaching", date: "2025-12-02T01:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Will from Mandolin <will@mandolin.com>" },
  { id: "66002ded-ce3d-4ced-a7c6-5a86b6420ff6", title: "Paul <> Adam coaching", date: "2025-11-26T20:30:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Devika Jones <devika.jones@charliehealth.com>, Paul Tyger <paul.tyger@charliehealth.com>" },
  { id: "0f49846c-150c-4973-8104-e516285f7871", title: "Ryan <> Adam coaching (intro)", date: "2025-11-26T19:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, Yara Gonzalez <yara.gonzalez@lovable.dev>, Ryan from Lovable <ryan@lovable.dev>" },
  { id: "c5607eed-2cfd-4355-998f-1991f1dc60a6", title: "John and Adam Donkin", date: "2025-11-26T16:00:00Z", participants_raw: "Adam (note creator) from Mochary Method <adam@mocharymethod.com>, John Thomas from Moonvalley <john@moonvalley.com>" },
  // === Range 2: Jan 26 2026 - Feb 24 2026 ===
  { id: "be03f72d-d675-4281-8c0b-1706f0265730", title: "Fitz <> Adam 1-1 coaching", date: "2026-02-24T22:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Fitz from Cardless <fitz@cardless.com>" },
  { id: "032937aa-643b-4b0e-9300-bc0afd1d0644", title: "Richard <> Adam 1-1 coaching", date: "2026-02-20T23:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Richard Price from Academia <richard@academia.edu>" },
  { id: "b6a32b2b-501f-48ef-9056-e0bff71b3ac5", title: "Karen <> Adam 1-1 coaching", date: "2026-02-20T19:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Karen Peters from Alo Yoga <karen.peters@aloyoga.com>" },
  { id: "07f69966-dc24-43b5-bc2c-308bf3382eb3", title: "Davis/Adam coaching", date: "2026-02-19T19:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Davis Lukens from Flocksafety <davis.lukens@flocksafety.com>" },
  { id: "4f940068-7672-4928-bede-f9637e6afcf6", title: "Meg <> Adam 1-1 coaching", date: "2026-02-19T17:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Meg from Flocksafety <meg@flocksafety.com>" },
  { id: "56897939-997b-43c8-bda9-992ea8a42052", title: "Scott/Adam 1-1 coaching (intro)", date: "2026-02-18T21:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Scott Miller <scott.miller@aloyoga.com>" },
  { id: "9af1dff5-3d1b-4386-be4f-d8e4928df981", title: "Adam/Jessie", date: "2026-02-18T19:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Jessie Barry <jb794@cornell.edu>" },
  { id: "289d1ae0-8850-499f-bc05-5488d7c43ff7", title: "Fitz/Adam 1-1s", date: "2026-02-18T17:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Fitz from Cardless <fitz@cardless.com>" },
  { id: "875008e2-cdc9-42e2-a94f-3b4210f0eaaa", title: "Will <> Adam 1-1 coaching", date: "2026-02-18T00:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Will from Mandolin <will@mandolin.com>" },
  { id: "9e351272-6151-4e0b-bfae-11e91008cc49", title: "Anshul Bhagi and Adam Donkin", date: "2026-02-17T21:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Anshul <anshul@turing.com>" },
  { id: "bd55ccdf-d174-4c92-b66a-8e04c7ee09d9", title: "Erica Brescia and Adam Donkin", date: "2026-02-17T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Erica Brescia from poolside <ebrescia@redpoint.com>" },
  { id: "96d86a65-dab2-4c15-8cbb-3d4bc3d57d68", title: "Richard <> Adam 1-1 coaching", date: "2026-02-13T23:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Richard Price from Academia <richard@academia.edu>, Academia-1-Ashtadhyayi (200) <c_18829prcmjppmhsenfi49tvdk6fse@resource.calendar.google.com>" },
  { id: "3367d708-f4fb-45dd-8486-ad225e02309c", title: "Adam Donkin | Nishad Acharya - Turing Exec Feedback", date: "2026-02-13T19:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Nishad from Turing <nishad@turing.com>, Emma Giles from Mocharymethod <emma@mocharymethod.com>" },
  { id: "3a01fc3e-d36c-440c-bc2e-27d96453dc38", title: "Fitz <> Adam 1-1 coaching", date: "2026-02-12T23:45:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Fitz from Cardless <fitz@cardless.com>, Kevin Coale from Kevincoale <kevin@kevincoale.xyz>" },
  { id: "c95fe933-e96c-4c7c-85e9-1dfac1856f7d", title: "Caroline <> Adam 1-1 coaching", date: "2026-02-12T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Caroline Wong from Lovable <caroline@lovable.dev>" },
  { id: "d0c400cb-04f1-4ed5-b2d0-958632a63413", title: "Becca Arneson and Adam Donkin", date: "2026-02-11T23:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Liza Heid <liza.heid@aloyoga.com>, Becca Arneson from Alo Yoga <becca.arneson@aloyoga.com>" },
  { id: "3744ccc6-d71b-4600-b12a-95c95879c47c", title: "Adam/Jessie", date: "2026-02-11T19:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Jessie Barry <jb794@cornell.edu>" },
  { id: "b2c62d82-38d8-4255-a81e-d29c9d3aa1e8", title: "Adam <> Alex coaching", date: "2026-02-11T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Alexandre from Lovable <alex@lovable.dev>" },
  { id: "daaca104-d7f1-4a7d-bff0-b5e57a9009a3", title: "Fabian <> Adam 1-1 coaching", date: "2026-02-09T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Fabian Hedin from Lovable <fabian@lovable.dev>, Jesper Lekland from Lovable <jesper@lovable.dev>" },
  { id: "bac3f4f7-cbaf-439a-b22e-d26e2338a3ce", title: "Ceci Stallsmith and Adam Donkin", date: "2026-02-05T21:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Ceci from Lovable <ceci@lovable.dev>" },
  { id: "065bf650-6a51-4d40-bf34-910eca33aa1d", title: "Nadia<>Adam 1-1 coaching", date: "2026-02-05T20:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Nadia Koritareva from AngelList <nadia@angellist.com>" },
  { id: "b7907668-8a22-4f77-a7d5-9dc751027fe1", title: "Christina <> Adam 1-1 coaching", date: "2026-02-05T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Christina Engebretson from Flocksafety <christina.engebretson@flocksafety.com>" },
  { id: "7d22e520-f175-4404-829c-7bdd0967464e", title: "Erica <> Adam 1-1 coaching", date: "2026-02-05T00:10:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Erica Brescia from poolside <ebrescia@redpoint.com>" },
  { id: "3610c4c6-f8f3-42ac-9a3d-7d1b6842692d", title: "Adam/Jessie", date: "2026-02-04T18:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Jessie Barry <jb794@cornell.edu>" },
  { id: "74873d5c-6786-459e-a9fb-3c6530e22770", title: "Will <> Adam 1-1 coaching", date: "2026-02-04T00:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Will from Mandolin <will@mandolin.com>" },
  { id: "9c3368fa-2ebc-4a50-9780-a8bb85e36974", title: "Meg <> Adam 1-1 coaching", date: "2026-02-03T22:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Meg from Flocksafety <meg@flocksafety.com>" },
  { id: "f07e426e-528b-438f-9457-ef69d190e6bd", title: "Becca/Adam sync", date: "2026-02-03T21:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Becca Arneson from Alo Yoga <becca.arneson@aloyoga.com>" },
  { id: "17f07b0f-6fd7-4a07-b998-78ff6fb70f87", title: "Samuel <> Adam coaching", date: "2026-02-02T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Samuel from Wincent <samuel@wincent.co>, Miro Skovajsa <miro.skovajsa@wincent.co>, Tom Mazur <tom.mazur@wincent.co>" },
  { id: "eeb136db-d9c1-4d58-8e1c-6718efa595b9", title: "Richard <> Adam coaching", date: "2026-01-29T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Richard Price from Academia <richard@academia.edu>, Academia-1-Reason for Hope (200) <c_1880fhaf0cmnci6sldftod0h6luje@resource.calendar.google.com>" },
  { id: "a107fbe6-46f1-49a8-84fe-ed025b48b566", title: "Fitz <> Adam 1-1 coaching", date: "2026-01-27T21:30:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Fitz from Cardless <fitz@cardless.com>" },
  { id: "3a9a797b-8190-49f5-a256-14c7a0394fd4", title: "Viky/Adam 1:1 coaching", date: "2026-01-27T17:00:00Z", participants_raw: "Adam Donkin (note creator) from Mochary Method <adam@mocharymethod.com>, Vignesh Kalimuthu from V7labs <viky@v7labs.com>" },
];

// Extract emails from participants_raw string
function extractEmails(raw) {
  const emails = [];
  const regex = /<([^>]+)>/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    emails.push(match[1].toLowerCase());
  }
  return emails;
}

// Match meetings to clients
const matched = [];
const skipped = [];

for (const m of meetings) {
  const emails = extractEmails(m.participants_raw);

  // Filter out internal/system emails
  const externalEmails = emails.filter(e =>
    !e.includes('@mocharymethod.com') &&
    !e.includes('@resource.calendar.google.com') &&
    !e.includes('@mochary.com') &&
    !e.includes('@fortiusventures.com') &&
    !e.includes('@alexanderadvisors.com') &&
    !e.includes('@kevincoale.xyz') &&
    !e.includes('@shultz.cpa')
  );

  // Find first client match
  let matchedClient = null;
  let matchedEmail = null;
  for (const email of externalEmails) {
    if (emailToClient[email]) {
      matchedClient = emailToClient[email];
      matchedEmail = email;
      break;
    }
  }

  if (matchedClient) {
    matched.push({
      meeting_id: m.id,
      title: m.title,
      meeting_date: m.date,
      client_id: matchedClient.id,
      client_name: matchedClient.name,
      client_email: matchedClient.email,
      match_email: matchedEmail,
    });
  } else {
    skipped.push({
      meeting_id: m.id,
      title: m.title,
      date: m.date,
      external_emails: externalEmails,
    });
  }
}

// Output results
console.error(`\n=== Matching Results ===`);
console.error(`Total meetings: ${meetings.length}`);
console.error(`Matched to clients: ${matched.length}`);
console.error(`Skipped (no match): ${skipped.length}`);

// Show unique clients matched
const clientCounts = {};
for (const m of matched) {
  clientCounts[m.client_name] = (clientCounts[m.client_name] || 0) + 1;
}
console.error(`\n=== Client Session Counts ===`);
for (const [name, count] of Object.entries(clientCounts).sort((a, b) => b[1] - a[1])) {
  console.error(`  ${name}: ${count} sessions`);
}

console.error(`\n=== Skipped Meetings ===`);
for (const s of skipped) {
  console.error(`  ${s.title} (${s.date}) - emails: ${s.external_emails.join(', ') || 'none'}`);
}

// Output matched meetings as JSON to stdout
console.log(JSON.stringify(matched, null, 2));
