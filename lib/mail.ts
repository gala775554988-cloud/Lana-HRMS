type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
};

export async function sendTransactionalEmail(message: TransactionalEmail) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Transactional email provider is not configured.");
  }

  console.info("Transactional email preview", message);
}
