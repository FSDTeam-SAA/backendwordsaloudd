import User from "../model/user.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const profileFields = [
  "_id",
  "user",
  "mainSkill",
  "extraSkills",
  "vipBySkill",
  "homeArea",
  "travelRange",
  "pitch",
  "typicalRate",
  "workPhotos",
  "verificationStatus",
  "verification",
  "isLive",
  "isVip",
  "ratingAverage",
  "ratingCount",
  "jobsCount",
  "contactChangeRequest",
  "createdAt",
  "updatedAt",
];

const copyFields = (source, fields) => fields.reduce((result, field) => {
  if (source?.[field] !== undefined) result[field] = source[field];
  return result;
}, {});

export const serializeVerificationRecord = (record) => {
  const user = record.queueUser;
  const tradesmanProfile = copyFields(record, profileFields);
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    area: user.area,
    profileImage: user.profileImage,
    isEmailVerified: user.isEmailVerified,
    isProfileComplete: user.isProfileComplete,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    tradesmanProfile,
  };
};

export const buildVerificationQueuePipeline = ({ status, search = "", page = 1, limit = 20 }) => {
  const normalizedSearch = String(search).trim();
  const skip = (page - 1) * limit;
  const pipeline = [
    { $match: { verificationStatus: status } },
    {
      $lookup: {
        from: User.collection.name,
        localField: "user",
        foreignField: "_id",
        as: "queueUser",
      },
    },
    { $unwind: "$queueUser" },
    { $match: { "queueUser.role": "tradesman" } },
  ];

  if (normalizedSearch) {
    const regex = new RegExp(escapeRegex(normalizedSearch), "i");
    pipeline.push({
      $match: {
        $or: [
          { "queueUser.firstName": regex },
          { "queueUser.lastName": regex },
          { "queueUser.email": regex },
          { "queueUser.phoneNumber": regex },
          { mainSkill: regex },
          { extraSkills: regex },
          { vipBySkill: regex },
        ],
      },
    });
  }

  pipeline.push(
    { $sort: { "verification.submittedAt": -1, updatedAt: -1, _id: 1 } },
    {
      $facet: {
        records: [{ $skip: skip }, { $limit: limit }],
        count: [{ $count: "total" }],
      },
    },
  );

  return pipeline;
};

export const queryVerificationQueue = async ({ status = "pending", search = "", page = 1, limit = 20 } = {}) => {
  const [result] = await TradesmanProfile.aggregate(
    buildVerificationQueuePipeline({ status, search, page, limit }),
  );
  const total = result?.count?.[0]?.total || 0;

  return {
    users: (result?.records || []).map(serializeVerificationRecord),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};
