export const sendWhatsAppReminder = (name, phone) => {
  const message = `Hello ${name}, this is a reminder that your library fee is due. Please pay as soon as possible.`;

  const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  window.open(link, "_blank");
};
