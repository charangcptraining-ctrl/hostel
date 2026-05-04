import React from 'react';
import { formatCurrency, Icons } from '../constants';
import { Payment, Resident, Property } from '../types';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';

interface PaymentReceiptProps {
  payment: Payment;
  resident?: Resident;
  property?: Property;
  onClose: () => void;
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({ payment, resident, property, onClose }) => {
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF('p', 'pt', 'a4');
      const margin = 40;
      const pageWidth = doc.internal.pageSize.width;

      // Header Decoration
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 0, pageWidth, 5, 'F');

      // Title
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('RENT RECEIPT', margin, 60);

      // Property Name
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139); // slate-400
      doc.text((property?.name || 'Your Property').toUpperCase(), margin, 75);

      // Receipt Info Grid
      const gridY = 120;
      
      // Box for resident info
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('RECEIPT TO', margin, gridY);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(resident?.name || 'Resident', margin, gridY + 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(`Room: ${resident?.roomNumber || 'N/A'}`, margin, gridY + 35);

      // Box for receipt info (right aligned)
      const rightColX = pageWidth - margin - 150;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('RECEIPT DETAILS', rightColX, gridY);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Date: ${payment.date}`, rightColX, gridY + 20);
      doc.text(`ID: ${payment.transactionId.toUpperCase()}`, rightColX, gridY + 35);

      // Amount Section
      const amountY = gridY + 80;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.roundedRect(margin, amountY, pageWidth - (margin * 2), 60, 10, 10, 'FD');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('TOTAL AMOUNT PAID', margin + 20, amountY + 35);
      
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const amountText = formatCurrency(payment.amount);
      const amountWidth = doc.getTextWidth(amountText);
      doc.text(amountText, pageWidth - margin - 20 - amountWidth, amountY + 38);

      // Payment Details
      const detailsY = amountY + 80;
      const colWidth = (pageWidth - (margin * 2) - 20) / 2;
      
      // Method
      doc.setFillColor(248, 250, 252, 0.5);
      doc.roundedRect(margin, detailsY, colWidth, 40, 8, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('METHOD', margin + 10, detailsY + 15);
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(payment.paymentMethod, margin + 10, detailsY + 30);

      // Status
      doc.setFillColor(248, 250, 252, 0.5);
      doc.roundedRect(margin + colWidth + 20, detailsY, colWidth, 40, 8, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('STATUS', margin + colWidth + 30, detailsY + 15);
      doc.setFontSize(10);
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(payment.status, margin + colWidth + 30, detailsY + 30);

      // Footer
      const footerY = pageWidth > 800 ? 750 : doc.internal.pageSize.height - 100;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('Thank you for choosing us!', pageWidth / 2, footerY, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`This is a computer-generated receipt for the rent paid for ${property?.name || 'the property'}.`, pageWidth / 2, footerY + 15, { align: 'center' });

      // Save
      doc.save(`Receipt_${payment.transactionId.slice(-6).toUpperCase()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to print if PDF generation fails
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl relative print:shadow-none print:rounded-none print:max-w-none print:p-0 flex flex-col max-h-[90vh]"
      >
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-slate-400 hover:bg-slate-900 hover:text-white transition-all transform hover:rotate-90 z-20 print:hidden shadow-sm"
        >
          <Icons.Close className="w-5 h-5" />
        </button>
        {/* Header decoration */}
        <div className="h-2 bg-gradient-to-r from-blue-600 to-emerald-500 shrink-0 print:hidden" />
        
        <div className="overflow-y-auto p-8 md:p-12 space-y-8 scrollbar-hide">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter">Rent Receipt</h1>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{property?.name || 'Your Property'}</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-50 border border-emerald-100 shrink-0">
              <Icons.Check className="w-5 h-5 md:w-6 md:h-6" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:gap-8 border-b border-slate-100 pb-8">
              <div className="min-w-0">
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt To</p>
                <p className="font-black text-slate-900 text-xs md:text-sm truncate">{resident?.name || 'Resident'}</p>
                <p className="text-[10px] md:text-xs font-bold text-slate-500 mt-0.5">Room {resident?.roomNumber || 'N/A'}</p>
              </div>
              <div className="text-right min-w-0">
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt Date</p>
                <p className="font-black text-slate-900 text-xs md:text-sm">{payment.date}</p>
                <p className="text-[10px] md:text-xs font-bold text-slate-500 mt-0.5 truncate">ID: {payment.transactionId.slice(-8).toUpperCase()}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <p className="text-[10px] md:text-xs font-black text-slate-600 uppercase tracking-widest">Amount Paid</p>
                <p className="text-xl md:text-2xl font-black text-slate-900">{formatCurrency(payment.amount)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100/50">
                  <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Method</p>
                  <p className="text-[10px] md:text-xs font-bold text-slate-700">{payment.paymentMethod}</p>
                </div>
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100/50">
                  <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Status</p>
                  <p className="text-[10px] md:text-xs font-bold text-emerald-600">{payment.status}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 text-center">
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                This is a computer-generated receipt for the rent paid for {property?.name}. 
                Thank you for choosing us!
              </p>
            </div>
          </div>

          <div className="flex gap-4 pt-4 print:hidden">
            <button 
              onClick={handleDownloadPDF}
              className="flex-1 px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2"
            >
              <Icons.Inventory className="w-3 h-3" />
              Download/Print
            </button>
            <button 
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentReceipt;
