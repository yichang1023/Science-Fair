// api/eval.js
// POST /api/eval
// body: { answer: string, groundTruth?: string, keywords?: string[] }

function normalize(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { answer, groundTruth, keywords } = req.body || {};
    if (typeof answer !== "string") {
      res.status(400).send("Missing or invalid 'answer'");
      return;
    }

    const ansN = normalize(answer);
    const gtN = typeof groundTruth === "string" ? normalize(groundTruth) : null;

    const lengthChars = answer.length;
    const hasUncertainty =
      /(可能|大概|我不確定|無法確定|也許|推測|不保證|不一定|建議查證)/.test(answer);
    const hasRefusal =
      /(我不能|無法|不提供|不方便|抱歉|無法協助|不能回答)/.test(answer);

    let exactMatch = null;
    let keywordCoverage = null;

    if (gtN) {
      exactMatch = ansN === gtN;

      const ks = Array.isArray(keywords) ? keywords : [];
      if (ks.length > 0) {
        const hit = ks.filter((k) => normalize(k) && ansN.includes(normalize(k)));
        keywordCoverage = {
          total: ks.length,
          hit: hit.length,
          ratio: ks.length ? hit.length / ks.length : null,
          hitList: hit,
        };
      }
    }

    let hallucinationFlag = null;
    if (gtN) {
      hallucinationFlag = !exactMatch && !hasRefusal;
    }

    res.status(200).json({
      ok: true,
      evaluable: Boolean(gtN),
      hallucinationFlag,
      exactMatch,
      keywordCoverage,
      quality: {
        lengthChars,
        hasUncertainty,
        hasRefusal,
      },
    });
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
};

