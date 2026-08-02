const styles = `
<style>
*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

body{
    font-family:Arial,Helvetica,sans-serif;
    color:#222;
    font-size:13px;
    padding:25px;
}

.header{
    text-align:center;
    border-bottom:3px solid #1E4F91;
    padding-bottom:15px;
    margin-bottom:25px;
}

.header h1{
    color:#1E4F91;
    font-size:34px;
    margin-bottom:8px;
}

.header p{
    font-size:14px;
    line-height:1.5;
}

.invoice-title{
    text-align:center;
    font-size:30px;
    font-weight:bold;
    color:#222;
    margin:20px 0;
}

.row{
    display:flex;
    justify-content:space-between;
    gap:25px;
    margin-bottom:25px;
}

.card{
    width:49%;
    border:1px solid #dcdcdc;
    border-radius:10px;
    padding:18px;
}

.card h3{
    color:#1E4F91;
    margin-bottom:15px;
    border-bottom:2px solid #eee;
    padding-bottom:8px;
}

.card table{
    width:100%;
}

.card td{
    padding:4px 0;
}

.table{
    width:100%;
    border-collapse:collapse;
    margin-top:20px;
}

.table th{
    background:#1E4F91;
    color:#fff;
    padding:10px;
    text-align:left;
}

.table td{
    padding:10px;
    border:1px solid #ddd;
}

.table tbody tr:nth-child(even){
    background:#f8f8f8;
}

.summary{
    width:360px;
    margin-left:auto;
    margin-top:30px;
    border:1px solid #ddd;
    border-radius:10px;
}

.summary table{
    width:100%;
}

.summary td{
    padding:10px 18px;
}

.total{
    background:#1E4F91;
    color:#fff;
    font-size:18px;
    font-weight:bold;
}

.green{
    color:#0b8f3d;
    font-weight:bold;
}

.red{
    color:#c62828;
    font-weight:bold;
}

.footer{
    margin-top:80px;
    display:flex;
    justify-content:space-between;
}

.sign{
    width:180px;
    text-align:center;
}

.line{
    border-top:1px solid #000;
    margin-top:50px;
    padding-top:8px;
}

.page{
    position:fixed;
    bottom:15px;
    right:20px;
    color:#888;
    font-size:12px;
}
</style>
`;

module.exports = styles;